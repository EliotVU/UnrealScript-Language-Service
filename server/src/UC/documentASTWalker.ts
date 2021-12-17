import {
    ANTLRErrorListener, CommonTokenStream, ParserRuleContext, RecognitionException, Recognizer,
    Token
} from 'antlr4ts';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { Position, Range } from 'vscode-languageserver-types';

import { UCLexer } from './antlr/generated/UCLexer';
import * as UCGrammar from './antlr/generated/UCParser';
import { UCParserVisitor } from './antlr/generated/UCParserVisitor';
import * as UCMacro from './antlr/generated/UCPreprocessorParser';
import { UCPreprocessorParserVisitor } from './antlr/generated/UCPreprocessorParserVisitor';
import { ErrorDiagnostic } from './diagnostics/diagnostic';
import { UCDocument } from './document';
import {
    IExpression, UCArrayCountExpression, UCAssignmentOperatorExpression, UCBinaryOperatorExpression,
    UCBoolLiteral, UCByteLiteral, UCCallExpression, UCConditionalExpression,
    UCDefaultAssignmentExpression, UCDefaultElementAccessExpression, UCDefaultMemberCallExpression,
    UCDefaultStructLiteral, UCElementAccessExpression, UCEmptyArgument, UCFloatLiteral,
    UCIdentifierLiteralExpression, UCIntLiteral, UCMemberExpression, UCMetaClassExpression,
    UCNameLiteral, UCNameOfExpression, UCNewExpression, UCNoneLiteral, UCObjectLiteral,
    UCParenthesizedExpression, UCPostOperatorExpression, UCPredefinedAccessExpression,
    UCPreOperatorExpression, UCPropertyAccessExpression, UCPropertyClassAccessExpression,
    UCRngLiteral, UCRotLiteral, UCSizeOfLiteral, UCStringLiteral, UCSuperExpression, UCVectLiteral
} from './expressions';
import { rangeFromBound, rangeFromBounds, rangeFromCtx } from './helpers';
import { config, setEnumMember, UCGeneration } from './indexer';
import { toName } from './name';
import {
    NAME_ARRAY, NAME_CLASS, NAME_DEFAULT, NAME_DELEGATE, NAME_ENUMCOUNT, NAME_MAP, NAME_NONE,
    NAME_REPLICATION
} from './names';
import {
    IStatement, UCArchetypeBlockStatement, UCAssertStatement, UCBlock, UCCaseClause,
    UCDefaultClause, UCDoUntilStatement, UCExpressionStatement, UCForEachStatement, UCForStatement,
    UCGotoStatement, UCIfStatement, UCLabeledStatement, UCRepIfStatement, UCReturnStatement,
    UCSwitchStatement, UCWhileStatement
} from './statements';
import {
    addHashedSymbol, FieldModifiers, Identifier, ISymbol, ISymbolContainer, ITypeSymbol,
    MethodSpecifiers, ParamModifiers, ReturnValueIdentifier, UCArchetypeSymbol, UCArrayTypeSymbol,
    UCBinaryOperatorSymbol, UCBoolTypeSymbol, UCButtonTypeSymbol, UCByteTypeSymbol, UCClassSymbol,
    UCConstSymbol, UCDefaultPropertiesBlock, UCDelegateSymbol, UCDelegateTypeSymbol,
    UCDocumentClassSymbol, UCEnumMemberSymbol, UCEnumSymbol, UCEventSymbol, UCFloatTypeSymbol,
    UCIntTypeSymbol, UCLocalSymbol, UCMapTypeSymbol, UCMethodSymbol, UCNameTypeSymbol,
    UCObjectTypeSymbol, UCParamSymbol, UCPointerTypeSymbol, UCPostOperatorSymbol,
    UCPredefinedTypeSymbol, UCPreOperatorSymbol, UCPropertySymbol, UCQualifiedTypeSymbol,
    UCReplicationBlock, UCScriptStructSymbol, UCStateSymbol, UCStringTypeSymbol, UCStructSymbol,
    UCSymbol, UCSymbolReference, UCTypeFlags
} from './Symbols';

function idFromCtx(ctx: ParserRuleContext) {
	const identifier: Identifier = {
		name: toName(ctx.text),
		range: rangeFromBound(ctx.start)
	};

	return identifier;
}

function idFromToken(token: Token) {
	const identifier: Identifier = {
		name: toName(token.text!),
		range: rangeFromBound(token)
	};

	return identifier;
}

function memberFromIdCtx(ctx: UCGrammar.IdentifierContext): UCMemberExpression {
	const expression = new UCMemberExpression(idFromCtx(ctx));
	return expression;
}

function blockFromStatementCtx(
	visitor: DocumentASTWalker,
	ctx: ParserRuleContext & { statement: () => UCGrammar.StatementContext[] }
): UCBlock | undefined {
	const statementNodes = ctx.statement();
	if (!statementNodes || statementNodes.length === 0) {
		return undefined;
	}

	const startToken = statementNodes[0].start;
	const stopToken = statementNodes[statementNodes.length - 1].stop;
	const block = new UCBlock(rangeFromBounds(startToken, stopToken));
	try {
		block.statements = new Array(statementNodes.length);
		for (let i = 0; i < statementNodes.length; ++i) {
			const statement: IStatement = statementNodes[i].accept(visitor);
			block.statements[i] = statement;
		}
	} catch (err) {
		console.error(`An errored ocurred when building statements for a codeblock in scope '${visitor.scope().getPath()}'!`);
		throw err;
	}
	return block;
}

function typeFromIds(identifiers: Identifier[]): UCQualifiedTypeSymbol | UCObjectTypeSymbol | undefined {
	if (identifiers.length === 1) {
		return new UCObjectTypeSymbol(identifiers[0]);
	} else if (identifiers.length > 1) {
		const get = (i: number): UCQualifiedTypeSymbol => {
			const type = new UCObjectTypeSymbol(identifiers[i]);
			const leftType = i - 1 > -1 ? get(--i) : undefined;
			return new UCQualifiedTypeSymbol(type, leftType);
		};
		return get(identifiers.length - 1);
	}
	return undefined;
}

function fetchSurroundingComments(tokenStream: CommonTokenStream, ctx: ParserRuleContext): Token[] | undefined {
	if (ctx.stop) {
		const index = ctx.stop.tokenIndex;
		const leadingComment = tokenStream
			.getHiddenTokensToRight(index, UCLexer.COMMENTS_CHANNEL)
			.filter(token => token.line === ctx.stop!.line)
			.shift();

		if (leadingComment) {
			return [leadingComment];
		}
	}

	const index = ctx.start.tokenIndex;
	const headerComment = tokenStream
		.getHiddenTokensToLeft(index, UCLexer.COMMENTS_CHANNEL)
		.filter(token => token.charPositionInLine === ctx.start.charPositionInLine);

	// return undefined when empty (i.e. may have found a comment, but it may have been filtered).
	return headerComment || undefined;
}

function createQualifiedType(ctx: UCGrammar.QualifiedIdentifierContext, type?: UCTypeFlags) {
	const leftId: Identifier = idFromCtx(ctx._left);
	const leftType = new UCObjectTypeSymbol(leftId, rangeFromCtx(ctx._left), type);

	if (ctx._right) {
		const rightId: Identifier = idFromCtx(ctx._right);
		const rightType = new UCObjectTypeSymbol(rightId, rangeFromCtx(ctx._right));

		const symbol = new UCQualifiedTypeSymbol(rightType, new UCQualifiedTypeSymbol(leftType));
		switch (type) {
			case UCTypeFlags.Struct:
				leftType.setValidTypeKind(UCTypeFlags.Class);
				break;

			case UCTypeFlags.State:
				leftType.setValidTypeKind(UCTypeFlags.Class);
				break;

			case UCTypeFlags.Delegate:
				leftType.setValidTypeKind(UCTypeFlags.Class);
				rightType.setValidTypeKind(UCTypeFlags.Delegate);
				break;

			case UCTypeFlags.Class:
				leftType.setValidTypeKind(UCTypeFlags.Package);
				break;

			default:
				leftType.setValidTypeKind(UCTypeFlags.Class);
				break;
		}
		return symbol;
	}
	return leftType;
}

export class DocumentASTWalker extends AbstractParseTreeVisitor<any> implements UCPreprocessorParserVisitor<any>, UCParserVisitor<any>, ANTLRErrorListener<Token> {
	private scopes: ISymbolContainer<ISymbol>[] = [];
	tokenStream: CommonTokenStream | undefined;

	TypeKeywordToTypeSymbolMap: { [key: number]: typeof UCPredefinedTypeSymbol } = {
		[UCLexer.KW_BYTE]		: UCByteTypeSymbol,
		[UCLexer.KW_FLOAT]		: UCFloatTypeSymbol,
		[UCLexer.KW_INT]		: UCIntTypeSymbol,
		[UCLexer.KW_STRING]		: UCStringTypeSymbol,
		[UCLexer.KW_NAME]		: UCNameTypeSymbol,
		[UCLexer.KW_BOOL]		: UCBoolTypeSymbol,
		[UCLexer.KW_POINTER]	: UCPointerTypeSymbol,
		[UCLexer.KW_BUTTON]		: UCButtonTypeSymbol
	};

	constructor(private document: UCDocument, scope: ISymbolContainer<ISymbol>) {
		super();
		this.scopes.push(scope);
	}

	push(newContext: ISymbolContainer<ISymbol>) {
		this.scopes.push(newContext);
	}

	pop() {
		this.scopes.pop();
	}

	scope<T extends ISymbolContainer<ISymbol> & UCSymbol>(): T {
		const scope = <T>this.scopes[this.scopes.length - 1];
		return scope;
	}

	declare(symbol: UCSymbol, ctx?: ParserRuleContext) {
		if (ctx) {
			symbol.description = fetchSurroundingComments(this.tokenStream!, ctx);
		}

		const scope = this.scope();
		scope.addSymbol(symbol);
	}

	syntaxError(_recognizer: Recognizer<Token, any>,
		offendingSymbol: Token | undefined,
		_line: number,
		_charPositionInLine: number,
		msg: string,
		error: RecognitionException | undefined
	) {
		const range = Range.create(Position.create(_line - 1, _charPositionInLine), Position.create(_line - 1, _charPositionInLine));
		const node = new ErrorDiagnostic(range, msg);
		this.document.nodes.push(node);
	}

	visitErrorNode(errNode: ErrorNode) {
		const node = new ErrorDiagnostic(rangeFromBound(errNode.symbol), '(ANTLR) ' + errNode.text);
		this.document.nodes.push(node);
		return undefined!;
	}

	visitMacroDefine(ctx: UCMacro.MacroDefineContext) {
		if (!ctx.isActive) {
			// TODO: mark range?
			return undefined;
		}
		const macro = ctx._MACRO_SYMBOL;
		const identifier = idFromToken(macro);
		// TODO: custom class
		const symbol = new UCPropertySymbol(identifier);
		this.document.addSymbol(symbol);
		return undefined;
	}

	visitIdentifier(ctx: UCGrammar.IdentifierContext): Identifier {
		const identifier: Identifier = {
			name: toName(ctx.text),
			range: rangeFromBound(ctx.start)
		};

		return identifier;
	}

	visitQualifiedIdentifier(ctx: UCGrammar.QualifiedIdentifierContext) {
		return createQualifiedType(ctx);
	}

	visitTypeDecl(typeDeclNode: UCGrammar.TypeDeclContext): ITypeSymbol {
		const rule = typeDeclNode.getChild(0) as ParserRuleContext;
		const ruleIndex = rule.ruleIndex;
		if (ruleIndex === UCGrammar.UCParser.RULE_structDecl) {
			const symbol: UCStructSymbol = this.visitStructDecl(rule as UCGrammar.StructDeclContext);
			const type = new UCObjectTypeSymbol(symbol.id, undefined, UCTypeFlags.Struct);
			// noIndex: true, because the struct will be indexed in its own index() call.
			type.setReference(symbol, this.document, true);
			return type;
		} else if (ruleIndex === UCGrammar.UCParser.RULE_enumDecl) {
			const symbol: UCEnumSymbol = this.visitEnumDecl(rule as UCGrammar.EnumDeclContext);
			const type = new UCObjectTypeSymbol(symbol.id, undefined, UCTypeFlags.Enum);
			// noIndex: true, because the enum will be indexed in its own index() call.
			type.setReference(symbol, this.document, true);
			return type;
		} else if (ruleIndex === UCGrammar.UCParser.RULE_primitiveType) {
			const tokenType = rule.start.type;
			const typeClass = this.TypeKeywordToTypeSymbolMap[tokenType];
			if (!typeClass) {
				throw "Unknown type for predefinedType() was encountered!";
			}

			const identifier: Identifier = {
				name: typeClass.getStaticName(),
				range: rangeFromBounds(rule.start, rule.stop)
			};
			const type = new typeClass(identifier);
			return type;
		} else if (ruleIndex === UCGrammar.UCParser.RULE_qualifiedIdentifier) {
			const type: ITypeSymbol = createQualifiedType(rule as UCGrammar.QualifiedIdentifierContext, UCTypeFlags.Type);
			return type;
		} else if (rule instanceof UCGrammar.ClassTypeContext) {
			const identifier: Identifier = {
				name: NAME_CLASS,
				range: rangeFromBound(rule.start)
			};
			const type = new UCObjectTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop), UCTypeFlags.Class);

			const idNode = rule.identifier();
			if (idNode) {
				const identifier = idFromCtx(idNode);
				type.baseType = new UCObjectTypeSymbol(identifier, undefined, UCTypeFlags.Class);
			}
			return type;
		} else if (rule instanceof UCGrammar.ArrayTypeContext) {
			const identifier: Identifier = {
				name: NAME_ARRAY,
				range: rangeFromBound(rule.start)
			};
			const arrayType = new UCArrayTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));

			const baseTypeNode = rule.varType();
			if (baseTypeNode) {
				const type: ITypeSymbol | undefined = this.visitTypeDecl(baseTypeNode.typeDecl());
				arrayType.baseType = type;
			}
			return arrayType;
		} else if (rule instanceof UCGrammar.DelegateTypeContext) {
			const identifier: Identifier = {
				name: NAME_DELEGATE,
				range: rangeFromBound(rule.start)
			};
			const delegateType = new UCDelegateTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
			delegateType.setValidTypeKind(UCTypeFlags.Delegate);

			const qualifiedNode = rule.qualifiedIdentifier();
			if (qualifiedNode) {
				const type: ITypeSymbol = createQualifiedType(qualifiedNode, UCTypeFlags.Delegate);
				delegateType.baseType = type;
			}
			return delegateType;
		} else if (rule instanceof UCGrammar.MapTypeContext) {
			const identifier: Identifier = {
				name: NAME_MAP,
				range: rangeFromBound(rule.start)
			};
			const type = new UCMapTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
			return type;
		}

		throw "Encountered an unknown typeDecl:" + typeDeclNode.toString();
	}

	visitClassDecl(ctx: UCGrammar.ClassDeclContext) {
		// Most of the time a document's tree is invalid as the end-user is writing code.
		// Therefor the parser may mistake "class'Object' <stuff here>;"" for a construction of a class declaration, this then leads to a messed up scope stack.
		// Or alternatively someone literally did try to declare another class?
		if (this.document.class) {
			this.document.nodes.push(new ErrorDiagnostic(rangeFromCtx(ctx), 'Cannot declare a class within another class!'));
			return undefined;
		}

		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCDocumentClassSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop), this.document);
		symbol.outer = this.document.classPackage;
		this.document.class = symbol; // Important!, must be assigned before further parsing.

        if (ctx.KW_INTERFACE()) {
            symbol.typeFlags |= UCTypeFlags.Interface;
        }
		addHashedSymbol(symbol);

		this.declare(symbol, ctx);

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = createQualifiedType(extendsNode._id, UCTypeFlags.Class);
		}

		const withinNode = ctx.withinClause();
		if (withinNode) {
			symbol.withinType = createQualifiedType(withinNode._id, UCTypeFlags.Class);
		}

        // Need to push before visiting modifiers.
		this.push(symbol);
		const modifierNodes = ctx.classModifier();
		for (const modifierNode of modifierNodes) {
            modifierNode.accept(this);
		}
		return symbol;
	}

    visitDependsOnModifier(ctx: UCGrammar.DependsOnModifierContext) {
        const symbol = this.scope<UCClassSymbol>();
        const modifierArgumentNodes = ctx.identifierArguments();
        if (modifierArgumentNodes) {
            symbol.dependsOnTypes = modifierArgumentNodes
                .identifier()
                .map(valueNode => {
                    const identifier: Identifier = valueNode.accept(this);
                    const typeSymbol = new UCObjectTypeSymbol(identifier, undefined, UCTypeFlags.Class);
                    return typeSymbol;
                });
        }
    }

    visitImplementsModifier(ctx: UCGrammar.ImplementsModifierContext) {
        const symbol = this.scope<UCClassSymbol>();
        const modifierArgumentNodes = ctx.qualifiedIdentifierArguments();
        if (modifierArgumentNodes) {
            symbol.implementsTypes = modifierArgumentNodes
                .qualifiedIdentifier()
                .map(valueNode => {
                    const typeSymbol = createQualifiedType(valueNode, UCTypeFlags.Class);
                    return typeSymbol;
                });
        }
    }

	visitConstDecl(ctx: UCGrammar.ConstDeclContext) {
		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCConstSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.description = fetchSurroundingComments(this.tokenStream!, ctx);

		if (ctx._expr) {
			symbol.expression = ctx._expr.accept(this);
		}

		if (this.document.class) {
			// Ensure that all constant declarations are always declared as a top level field (i.e. class)
			this.document.class.addSymbol(symbol);
		}
		return symbol;
	}

	visitEnumDecl(ctx: UCGrammar.EnumDeclContext) {
		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCEnumSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		this.declare(symbol, ctx);
		addHashedSymbol(symbol);

		this.push(symbol);
		try {
			let count = 0;
			const memberNodes = ctx.enumMember();
			for (const memberNode of memberNodes) {
				const memberSymbol: UCEnumMemberSymbol = memberNode.accept(this);
				// HACK: overwrite define() outer let.
				memberSymbol.outer = symbol;
				memberSymbol.value = count++;
			}
            symbol.maxValue = count;

            if (config.generation === UCGeneration.UC3) {
                if (symbol.children) {
                    const prefixIndex = symbol.children.id.name.text.lastIndexOf('_');
                    if (prefixIndex !== -1) {
                        const prefix = symbol.children.id.name.text.substring(0, prefixIndex);
                        const maxName = toName(prefix + "_MAX");
                        const enumId: Identifier = { name: maxName, range: identifier.range };
                        const maxEnumMember = new UCEnumMemberSymbol(enumId, enumId.range);
                        maxEnumMember.modifiers |= FieldModifiers.Generated;
                        maxEnumMember.outer = symbol;
                        maxEnumMember.value = count;
                        this.declare(maxEnumMember);
                        setEnumMember(maxEnumMember);
                    }
                }
            }

			// Insert the intrinsic "EnumCount" as an enum member,
            // -- but don't register it, we don't want to index, nor link it in the linked children..
			const enumId: Identifier = { name: NAME_ENUMCOUNT, range: identifier.range };
			const enumCountMember = new UCEnumMemberSymbol(enumId, enumId.range);
            enumCountMember.modifiers |= FieldModifiers.Intrinsic;
            // FIXME: Is this worth it? This allows an end-user to find all its references.
			enumCountMember.outer = symbol;
			enumCountMember.value = count;
            symbol.enumCountMember = enumCountMember;
        } finally {
			this.pop();
		}
		return symbol;
	}

	visitEnumMember(ctx: UCGrammar.EnumMemberContext) {
		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCEnumMemberSymbol(identifier);
		this.declare(symbol, ctx);
		setEnumMember(symbol);
		return symbol;
	}

	visitStructDecl(ctx: UCGrammar.StructDeclContext) {
		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCScriptStructSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = createQualifiedType(extendsNode._id, UCTypeFlags.Struct);
		}

		this.declare(symbol, ctx);
		addHashedSymbol(symbol);

		this.push(symbol);
		try {
			const memberNodes = ctx.structMember();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitReplicationBlock(ctx: UCGrammar.ReplicationBlockContext) {
		const identifier: Identifier = {
			name: NAME_REPLICATION,
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCReplicationBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.super = this.document.class;
		this.declare(symbol, ctx);

		const statementNodes = ctx.replicationStatement();
		if (!statementNodes) {
			return;
		}

		const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
		block.statements = Array(statementNodes.length);
		for (let i = 0; i < statementNodes.length; ++i) {
			const statement = statementNodes[i].accept(this);
			block.statements[i] = statement;
		}
		symbol.block = block;
		return symbol;
	}

	visitFunctionDecl(ctx: UCGrammar.FunctionDeclContext) {
		const nameNode: UCGrammar.FunctionNameContext | undefined = ctx.functionName();

		let modifiers: FieldModifiers = 0;
		let specifiers: MethodSpecifiers = MethodSpecifiers.None;
		let precedence: number | undefined;

		const specifierNodes = ctx.functionSpecifier();
		for (const specifier of specifierNodes) {
			switch (specifier.start.type) {
				case UCGrammar.UCParser.KW_NATIVE:
					modifiers |= FieldModifiers.Native;
					break;
				case UCGrammar.UCParser.KW_INTRINSIC:
					modifiers |= FieldModifiers.Native;
					break;
				case UCGrammar.UCParser.KW_CONST:
					modifiers |= FieldModifiers.ReadOnly;
					break;
				case UCGrammar.UCParser.KW_PROTECTED:
					modifiers |= FieldModifiers.Protected;
					break;
				case UCGrammar.UCParser.KW_PRIVATE:
					modifiers |= FieldModifiers.Private;
					break;
				case UCGrammar.UCParser.KW_FUNCTION:
					specifiers |= MethodSpecifiers.Function;
					break;
				case UCGrammar.UCParser.KW_OPERATOR:
					specifiers |= MethodSpecifiers.Operator;
					if (specifier._operatorPrecedence) {
						precedence = Number(specifier._operatorPrecedence.text);
					}
					break;
				case UCGrammar.UCParser.KW_PREOPERATOR:
					specifiers |= MethodSpecifiers.PreOperator;
					break;
				case UCGrammar.UCParser.KW_POSTOPERATOR:
					specifiers |= MethodSpecifiers.PostOperator;
					break;
				case UCGrammar.UCParser.KW_DELEGATE:
					specifiers |= MethodSpecifiers.Delegate;
					break;
				case UCGrammar.UCParser.KW_EVENT:
					specifiers |= MethodSpecifiers.Event;
					break;
				case UCGrammar.UCParser.KW_STATIC:
					specifiers |= MethodSpecifiers.Static;
					break;
				case UCGrammar.UCParser.KW_FINAL:
					specifiers |= MethodSpecifiers.Final;
					break;
				case UCGrammar.UCParser.KW_TRANSIENT:
					modifiers |= FieldModifiers.Transient;
					break;
			}
		}

		const type = (specifiers & MethodSpecifiers.Function)
			? UCMethodSymbol
			: (specifiers & MethodSpecifiers.Event)
			? UCEventSymbol
			: (specifiers & MethodSpecifiers.Operator)
			? UCBinaryOperatorSymbol
			: (specifiers & MethodSpecifiers.PreOperator)
			? UCPreOperatorSymbol
			: (specifiers & MethodSpecifiers.PostOperator)
			? UCPostOperatorSymbol
			: (specifiers & MethodSpecifiers.Delegate)
			? UCDelegateSymbol
			: UCMethodSymbol;

		if ((specifiers & MethodSpecifiers.HasKind) === 0) {
			this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.start),
				`Method must be declared as either one of the following: (Function, Event, Operator, PreOperator, PostOperator, or Delegate).`
			));
		}

		const range = rangeFromBounds(ctx.start, ctx.stop);
		// nameNode may be undefined if the end-user is in process of writing a new function.
		const identifier: Identifier = nameNode
			? idFromCtx(nameNode)
			: { name: NAME_NONE, range };
		const symbol = new type(identifier, range);
		symbol.specifiers |= specifiers;
		symbol.modifiers |= modifiers;
		if (precedence) {
			(symbol as UCBinaryOperatorSymbol).precedence = precedence;
		}
		this.declare(symbol, ctx);

		this.push(symbol);
		try {
			if (ctx._returnParam) {
				let paramModifiers: ParamModifiers = ParamModifiers.ReturnParam;
				const modifierNode = ctx._returnParam.returnTypeModifier();
				if (modifierNode?.start.type === UCGrammar.UCParser.KW_COERCE) {
					paramModifiers |= ParamModifiers.Coerce;
				}

				const typeSymbol = this.visitTypeDecl(ctx._returnParam.typeDecl());
				const returnValue = new UCParamSymbol(ReturnValueIdentifier, rangeFromBounds(ctx.start, ctx.stop));
				returnValue.type = typeSymbol;
				returnValue.paramModifiers |= paramModifiers;

				this.declare(returnValue);
				symbol.returnValue = returnValue;
			}

			if (ctx._params) {
                const paramNodes = ctx._params.paramDecl();
				symbol.params = Array(paramNodes.length);
                for (let i = 0; i < paramNodes.length; ++ i) {
                    symbol.params[i] = paramNodes[i].accept(this);
                }

				// if ((specifiers & MethodSpecifiers.Operator) !== 0) {
				// 	const leftType = symbol.params[0].getType();
				// 	const rightType = symbol.params[1].getType();

				// 	const leftTypeName = leftType && leftType.getId();
				// 	const rightTypeName = rightType && rightType.getId();

				// 	const overloadedName = symbol.getId().toString() + leftTypeName + rightTypeName;
				// }
			}

			try {
				const bodyNode = ctx.functionBody();
				if (bodyNode) {
					bodyNode.accept(this);
				}
			} catch (err) {
				console.error(`Encountered an error while constructing the body for function '${symbol.getPath()}'`, err);
			}
		} catch (err) {
			console.error(`Encountered an error while constructing function '${symbol.getPath()}'`, err);
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitFunctionBody(ctx: UCGrammar.FunctionBodyContext) {
		const memberNodes = ctx.functionMember();
		if (memberNodes) for (const member of memberNodes) {
			member.accept(this);
		}

		const method = this.scope<UCMethodSymbol>();
		method.block = blockFromStatementCtx(this, ctx);
	}

	visitParamDecl(ctx: UCGrammar.ParamDeclContext) {
		let modifiers: FieldModifiers = 0;
		let paramModifiers: ParamModifiers = 0;
		const modifierNodes = ctx.paramModifier();
		for (const modNode of modifierNodes) {
			switch (modNode.start.type) {
				case UCGrammar.UCParser.KW_CONST:
					modifiers |= FieldModifiers.ReadOnly;
					break;
				case UCGrammar.UCParser.KW_OUT:
					paramModifiers |= ParamModifiers.Out;
					break;
				case UCGrammar.UCParser.KW_OPTIONAL:
					paramModifiers |= ParamModifiers.Optional;
					break;
				case UCGrammar.UCParser.KW_COERCE:
					paramModifiers |= ParamModifiers.Coerce;
					break;
				case UCGrammar.UCParser.KW_REF:
					paramModifiers |= ParamModifiers.Ref;
					break;
			}
		}

		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNode = ctx.variable();

		const identifier: Identifier = idFromCtx(varNode.identifier());
		const symbol = new UCParamSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.type = typeSymbol;
		if (ctx._expr) {
			symbol.defaultExpression = ctx._expr.accept(this);
			paramModifiers |= ParamModifiers.Optional;
		}
		symbol.modifiers |= modifiers;
		symbol.paramModifiers |= paramModifiers;

		this.initVariable(symbol, varNode);
		this.declare(symbol, ctx);
		return symbol;
	}

	initVariable(property: UCPropertySymbol, ctx: UCGrammar.VariableContext) {
		const arrayDimNode = ctx._arrayDim;
		if (!arrayDimNode) {
			return;
		}

		property.modifiers |= FieldModifiers.WithDimension;

		const qualifiedNode = arrayDimNode.qualifiedIdentifier();
		if (qualifiedNode) {
			property.arrayDimRef = qualifiedNode.accept(this);
			property.arrayDimRange = property.arrayDimRef?.getRange();
			return;
		}

		const intNode = arrayDimNode.INTEGER();
		if (intNode) {
			property.arrayDim = Number.parseInt(intNode.text);
			property.arrayDimRange = rangeFromBound(intNode.symbol);
		}
	}

	visitLocalDecl(ctx: UCGrammar.LocalDeclContext) {
		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNodes = ctx.variable();
		for (const varNode of varNodes) {
			const symbol: UCLocalSymbol = varNode.accept(this);
			symbol.type = typeSymbol;
			this.declare(symbol, ctx);
		}
		return undefined;
	}

	visitVarDecl(ctx: UCGrammar.VarDeclContext) {
        let modifiers: FieldModifiers = 0;

		const declTypeNode: UCGrammar.VarTypeContext | undefined = ctx.varType();
		if (typeof declTypeNode !== 'undefined') {
            const modifierNodes = declTypeNode.variableModifier();
            for (const modNode of modifierNodes) {
                switch (modNode.start.type) {
                    case UCGrammar.UCParser.KW_CONST:
                        modifiers |= FieldModifiers.ReadOnly;
                        break;
                    case UCGrammar.UCParser.KW_NATIVE:
                        modifiers |= FieldModifiers.Native;
                        break;
                    case UCGrammar.UCParser.KW_INTRINSIC:
                        modifiers |= FieldModifiers.Native;
                        break;
                    case UCGrammar.UCParser.KW_PROTECTED:
                        modifiers |= FieldModifiers.Protected;
                        break;
                    case UCGrammar.UCParser.KW_PRIVATE:
                        modifiers |= FieldModifiers.Private;
                        break;
                    case UCGrammar.UCParser.KW_DUPLICATETRANSIENT:
                    case UCGrammar.UCParser.KW_TRANSIENT:
                        modifiers |= FieldModifiers.Transient;
                        break;
                }
            }
        }

		const typeSymbol = declTypeNode && this.visitTypeDecl(declTypeNode.typeDecl());
		const varNodes = ctx.variable();
		if (varNodes) for (const varNode of varNodes) {
			const symbol: UCPropertySymbol = varNode.accept(this);
			symbol.type = typeSymbol;
			symbol.modifiers |= modifiers;
			this.declare(symbol, ctx);
		}
		return undefined;
	}

	visitVariable(ctx: UCGrammar.VariableContext) {
		const type = ctx.parent instanceof UCGrammar.LocalDeclContext
			? UCLocalSymbol
			: UCPropertySymbol;

		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol: UCPropertySymbol = new type(
			identifier,
			// Stop at varCtx instead of localCtx for multiple variable declarations.
			rangeFromBounds(ctx.parent!.start, ctx.stop)
		);
		this.initVariable(symbol, ctx);
		return symbol;
	}

	visitStateDecl(ctx: UCGrammar.StateDeclContext) {
		const identifier: Identifier = idFromCtx(ctx.identifier());
		const symbol = new UCStateSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = createQualifiedType(extendsNode._id, UCTypeFlags.State);
		}

		this.declare(symbol, ctx);

		this.push(symbol);
		try {
			const memberNodes = ctx.stateMember();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
			symbol.block = blockFromStatementCtx(this, ctx);
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitIgnoresDecl(ctx: UCGrammar.IgnoresDeclContext) {
		const scope = this.scope<UCStateSymbol>();
		if (!scope.ignoreRefs) {
			scope.ignoreRefs = [];
		}
		const idNodes = ctx.identifier();
        if (idNodes) {
            scope.ignoreRefs = idNodes.map(n => {
                const identifier: Identifier = idFromCtx(n);
                const ref = new UCSymbolReference(identifier);
                return ref;
            });
        }
		return undefined;
	}

	visitStructDefaultPropertiesBlock(ctx: UCGrammar.StructDefaultPropertiesBlockContext) {
		const identifier: Identifier = { name: NAME_DEFAULT, range: rangeFromBound(ctx.start) };
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const symbol = new UCDefaultPropertiesBlock(identifier, range);
		symbol.super = this.scope<UCStructSymbol>();

		this.declare(symbol, ctx);
		this.push(symbol);
		try {
			const statements = ctx.defaultStatement()?.map(node => node.accept(this));
			if (statements) {
				const block = new UCBlock(range);
				block.statements = statements;
				symbol.block = block;
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitDefaultPropertiesBlock(ctx: UCGrammar.DefaultPropertiesBlockContext) {
		const identifier: Identifier = { name: NAME_DEFAULT, range: rangeFromBound(ctx.start) };
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const symbol = new UCDefaultPropertiesBlock(identifier, range);
		symbol.super = this.scope<UCStructSymbol>();

        // TODO: Scope these to its own outer e.g. UE3 > Default__ContainedClassName.StaticMeshComponent0 and UE2 > ContainedClassName.StaticMeshComponent0
		this.declare(symbol, ctx);
		this.push(symbol);
		try {
			const statements = ctx.defaultStatement()?.map(node => node.accept(this));
			if (statements) {
				const block = new UCBlock(range);
				block.statements = statements;
				symbol.block = block;
			}
		} finally {
			this.pop();
		}
        return symbol;
	}

	visitObjectDecl(ctx: UCGrammar.ObjectDeclContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const block = new UCArchetypeBlockStatement(range);

        let nameExpr: UCDefaultAssignmentExpression | undefined;
        let nameId: Identifier | undefined;
        let nameType: UCObjectTypeSymbol | undefined;
		let classExpr: UCDefaultAssignmentExpression | undefined;
        let classId: Identifier | undefined;
        let classType: UCObjectTypeSymbol | undefined;

        const hardcodedStatements: IExpression[] = [];
		const attrs = ctx.objectAttribute();
		if (attrs) for (const objAttr of attrs) {
			switch (objAttr._id.type) {
				case UCLexer.KW_NAME: {
                    nameExpr = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));
                    nameExpr.left = new UCMemberExpression(idFromToken(objAttr._id));
                    nameId = idFromCtx(objAttr._value);
                    const idExpr = new UCIdentifierLiteralExpression(nameId);
                    nameType = new UCObjectTypeSymbol(nameId, undefined, UCTypeFlags.Object);
                    idExpr.typeRef = nameType;
                    nameExpr.right = idExpr;
                    hardcodedStatements.push(nameExpr);
					break;
                }

				case UCLexer.KW_CLASS: {
                    classExpr = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));
                    classExpr.left = new UCMemberExpression(idFromToken(objAttr._id));
                    classId = idFromCtx(objAttr._value);
                    const idExpr = new UCIdentifierLiteralExpression(classId);
                    classType = new UCObjectTypeSymbol(classId, undefined, UCTypeFlags.Class);
                    idExpr.typeRef = classType;
                    classExpr.right = idExpr;
                    hardcodedStatements.push(classExpr);
					break;
                }

				default:
					throw Error(`Invalid archetype '${objAttr._id.text}' variable!`);
			}
		}

		const archId = nameId || { name: NAME_NONE, range };
		const symbol = new UCArchetypeSymbol(archId, range);
		if (classType) {
			symbol.extendsType = classType;
		}
        if (nameType) {
            nameType.setReference(symbol, this.document);
        }
        block.archetypeSymbol = symbol;

		this.declare(symbol, ctx);
		this.push(symbol);
		try {
			const statementNodes = ctx.defaultStatement();
			block.statements = hardcodedStatements
                .concat(statementNodes.map(node => node.accept(this)));
		} finally {
			this.pop();
		}
		return block;
	}

	visitDefaultStatement(ctx: UCGrammar.DefaultStatementContext) {
		const child = ctx.getChild(0);
		return child?.accept(this);
	}

	visitDefaultLiteral(ctx: UCGrammar.DefaultLiteralContext) {
		const child = ctx.getChild(0);
		return child?.accept(this);
	}

	visitDefaultArgument(ctx: UCGrammar.DefaultArgumentContext) {
		const child = ctx.getChild(0);
		return child?.accept(this);
	}

	visitDefaultAssignmentExpression(ctx: UCGrammar.DefaultAssignmentExpressionContext) {
		const expression = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx.defaultExpression();
		expression.left = primaryNode.accept(this);

		const exprNode = ctx.defaultLiteral();
		if (exprNode) {
			expression.right = exprNode.accept(this);
		}
		return expression;
	}

	visitDefaultMemberExpression(ctx: UCGrammar.DefaultMemberExpressionContext) {
		return memberFromIdCtx(ctx.identifier());
	}

	visitDefaultMemberCallExpression(ctx: UCGrammar.DefaultMemberCallExpressionContext) {
		const expression = new UCDefaultMemberCallExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.propertyMember = memberFromIdCtx(ctx.identifier(0));
		expression.methodMember = memberFromIdCtx(ctx.identifier(1));
		expression.arguments = ctx.arguments()?.accept(this);
		return expression;
	}

	visitDefaultElementAccessExpression(ctx: UCGrammar.DefaultElementAccessExpressionContext) {
		const expression = new UCDefaultElementAccessExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.expression = memberFromIdCtx(ctx.identifier());
		expression.argument = ctx._arg?.accept(this);
		return expression;
	}

	visitExpressionStatement(ctx: UCGrammar.ExpressionStatementContext) {
		const expression: IExpression = ctx.getChild(0).accept(this)!;
		const statement = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.expression = expression;
		return statement;
	}

	visitLabeledStatement(ctx: UCGrammar.LabeledStatementContext): UCLabeledStatement {
		const statement = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
		const idNode = ctx.identifier();
		statement.label = idFromCtx(idNode);
        const struct = this.scope<UCStructSymbol>();
        struct.addLabel(statement.label);
		return statement;
	}

	visitReturnStatement(ctx: UCGrammar.ReturnStatementContext): IStatement {
		const statement = new UCReturnStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}
		return statement;
	}

	visitGotoStatement(ctx: UCGrammar.GotoStatementContext): IStatement {
		const statement = new UCGotoStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}
		return statement;
	}

	visitReplicationStatement(ctx: UCGrammar.ReplicationStatementContext): UCIfStatement {
		const statement = new UCRepIfStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

        const idNodes = ctx.identifier();
        if (idNodes) {
            statement.symbolRefs = idNodes.map(n => {
                const identifier = idFromCtx(n);
                const ref = new UCSymbolReference(identifier);
                return ref;
            });
        }
		return statement;
	}

	visitWhileStatement(ctx: UCGrammar.WhileStatementContext): UCWhileStatement {
		const statement = new UCWhileStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		statement.then = blockFromStatementCtx(this, blockNode);
		return statement;
	}

	visitIfStatement(ctx: UCGrammar.IfStatementContext): UCIfStatement {
		const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		statement.then = blockFromStatementCtx(this, blockNode);

		const elseStatementNode = ctx.elseStatement();
		if (elseStatementNode) {
			statement.else = elseStatementNode.accept(this);
		}
		return statement;
	}

	visitElseStatement(ctx: UCGrammar.ElseStatementContext) {
		const blockNode = ctx.codeBlockOptional();
		return blockFromStatementCtx(this, blockNode);
	}

	visitDoStatement(ctx: UCGrammar.DoStatementContext): UCDoUntilStatement {
		const statement = new UCDoUntilStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		statement.then = blockFromStatementCtx(this, blockNode);
		return statement;
	}

	visitForeachStatement(ctx: UCGrammar.ForeachStatementContext): UCForEachStatement {
		const statement = new UCForEachStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		statement.then = blockFromStatementCtx(this, blockNode);
		return statement;
	}

	visitForStatement(ctx: UCGrammar.ForStatementContext): UCForStatement {
		const statement = new UCForStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._initExpr) {
			statement.init = ctx._initExpr.accept(this);
		}

		// Not really a valid expression with an assignment, but this is done this way for our convenience.
		// TODO: Obviously check if type can be resolved to a boolean!
		if (ctx._condExpr) {
			statement.expression = ctx._condExpr.accept(this);
		}

		if (ctx._nextExpr) {
			statement.next = ctx._nextExpr.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		statement.then = blockFromStatementCtx(this, blockNode);
		return statement;
	}

	visitSwitchStatement(ctx: UCGrammar.SwitchStatementContext): IStatement {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const statement = new UCSwitchStatement(range);

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}

		const clauseNodes: ParserRuleContext[] = ctx.caseClause() || [];
		const defaultClauseNode = ctx.defaultClause();

		if (defaultClauseNode) {
			clauseNodes.push(defaultClauseNode);
		}

		const block = new UCBlock(range);
		block.statements = Array(clauseNodes.length);
		for (let i = 0; i < clauseNodes.length; ++i) {
			const caseStatement: IStatement = clauseNodes[i].accept(this);
			block.statements[i] = caseStatement;
		}
		statement.then = block;

		return statement;
	}

	visitCaseClause(ctx: UCGrammar.CaseClauseContext): IStatement {
		const statement = new UCCaseClause(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}
		statement.then = blockFromStatementCtx(this, ctx);
		return statement;
	}

	visitDefaultClause(ctx: UCGrammar.DefaultClauseContext) {
		const statement = new UCDefaultClause(rangeFromBounds(ctx.start, ctx.stop));
		statement.then = blockFromStatementCtx(this, ctx);
		return statement;
	}

	visitAssertStatement(ctx: UCGrammar.AssertStatementContext): IStatement {
		const statement = new UCAssertStatement(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			statement.expression = ctx._expr.accept(this);
		}
		return statement;
	}

	visitAssignmentExpression(ctx: UCGrammar.AssignmentExpressionContext) {
		const expression = new UCAssignmentOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

		const operatorNode = ctx._id;
		const identifier: Identifier = {
			name: toName(operatorNode.text!),
			range: rangeFromBound(operatorNode)
		};

		if (operatorNode.text !== '=') {
			expression.operator = new UCSymbolReference(identifier);
		}

		const primaryNode = ctx._left;
		expression.left = primaryNode.accept(this);

		const exprNode = ctx._right;
		if (exprNode) {
			expression.right = exprNode.accept(this);
		} else {
			this.document.nodes.push(new ErrorDiagnostic(identifier.range, "Expression expected."));
		}

		return expression;
	}

	visitConditionalExpression(ctx: UCGrammar.ConditionalExpressionContext) {
		const expression = new UCConditionalExpression(rangeFromBounds(ctx.start, ctx.stop));

		const conditionNode = ctx._cond;
		if (conditionNode) {
			expression.condition = conditionNode.accept(this);
		}

		const leftNode = ctx._left;
		if (leftNode) {
			expression.true = leftNode.accept(this);
		}

		const rightNode = ctx._right;
		if (rightNode) {
			expression.false = rightNode.accept(this);
		}
		return expression;
	}

	visitBinaryOperatorExpression(ctx: UCGrammar.BinaryOperatorExpressionContext) {
		const expression = new UCBinaryOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

		const leftNode = ctx._left;
		if (leftNode) {
			expression.left = leftNode.accept(this);
		}

		const operatorNode = ctx._id;
		const identifier: Identifier = {
			name: toName(operatorNode.text!),
			range: rangeFromBound(operatorNode)
		};
		expression.operator = new UCSymbolReference(identifier);

		const rightNode = ctx._right;
		if (rightNode) {
			expression.right = rightNode.accept(this);
		} else {
			this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(operatorNode), "Expression expected."));
		}
		return expression;
	}

	visitBinaryNamedOperatorExpression(ctx: UCGrammar.BinaryNamedOperatorExpressionContext) {
		const expression = new UCBinaryOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

		const leftNode = ctx._left;
		if (leftNode) {
			expression.left = leftNode.accept(this);
		}

		const operatorNode = ctx._id;
		const identifier = idFromToken(operatorNode);
		expression.operator = new UCSymbolReference(identifier);

		const rightNode = ctx._right;
		if (rightNode) {
			expression.right = rightNode.accept(this);
		} else {
			this.document.nodes.push(new ErrorDiagnostic(identifier.range, "Expression expected."));
		}
		return expression;
	}

	visitPostOperatorExpression(ctx: UCGrammar.PostOperatorExpressionContext) {
		const expression = new UCPostOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx._left;
		expression.expression = primaryNode.accept(this);

		const operatorNode = ctx._id;
		const identifier: Identifier = {
			name: toName(operatorNode.text!),
			range: rangeFromBound(operatorNode)
		};
		expression.operator = new UCSymbolReference(identifier);
		return expression;
	}

	visitPreOperatorExpression(ctx: UCGrammar.PreOperatorExpressionContext) {
		const expression = new UCPreOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx._right;
		expression.expression = primaryNode.accept(this);

		const operatorNode = ctx._id;
		const identifier: Identifier = {
			name: toName(operatorNode.text!),
			range: rangeFromBound(operatorNode)
		};
		expression.operator = new UCSymbolReference(identifier);
		return expression;
	}

	// visitPostNamedOperatorExpression(ctx: UCGrammar.PostNamedOperatorExpressionContext) {
	// 	const expression = new UCPostOperatorExpression();

	// 	const primaryNode = ctx._left;
	// 	expression.expression = primaryNode.accept(this);

	// 	const operatorNode = ctx._id;
	// 	expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
	// 	return expression;
	// }

	// visitPreNamedOperatorExpression(ctx: UCGrammar.PreNamedOperatorExpressionContext) {
	// 	const expression = new UCPreOperatorExpression();

	// 	const primaryNode = ctx._right;
	// 	expression.expression = primaryNode.accept(this);

	// 	const operatorNode = ctx._id;
	// 	expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
	// 	return expression;
	// }

	visitParenthesizedExpression(ctx: UCGrammar.ParenthesizedExpressionContext) {
		const expression = new UCParenthesizedExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.expression = ctx._expr?.accept<IExpression>(this);
		return expression;
	}

	visitPropertyAccessExpression(ctx: UCGrammar.PropertyAccessExpressionContext) {
		const expression = new UCPropertyAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx.primaryExpression();
		expression.left = primaryNode.accept<IExpression>(this);

		const idNode = ctx.identifier();
        if (idNode) {
            expression.member = memberFromIdCtx(idNode);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.stop!),
				`Identifier expected.`
			));
        }
		return expression;
	}

	visitPropertyClassAccessExpression(ctx: UCGrammar.PropertyClassAccessExpressionContext) {
		const expression = new UCPropertyClassAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx.primaryExpression();
		expression.left = primaryNode.accept<IExpression>(this);

		const idNode = ctx.identifier();
        if (idNode) {
            expression.member = memberFromIdCtx(idNode);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.stop!),
				`Identifier expected.`
			));
        }
		return expression;
	}

	visitMemberExpression(ctx: UCGrammar.MemberExpressionContext) {
		return memberFromIdCtx(ctx.identifier());
	}

	visitCallExpression(ctx: UCGrammar.CallExpressionContext) {
		const expression = new UCCallExpression(rangeFromBounds(ctx.start, ctx.stop));

		// expr ( arguments )
		const exprNode = ctx.primaryExpression();
		expression.expression = exprNode.accept(this);

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this);
		}
		return expression;
	}

	visitArguments(ctx: UCGrammar.ArgumentsContext): IExpression[] | undefined {
		const argumentNodes = ctx.argument();
		if (!argumentNodes) {
			return undefined;
		}

		const exprArgs = new Array(argumentNodes.length);
		for (let i = 0; i < exprArgs.length; ++i) {
			const argNode = argumentNodes[i];
			const expr = argNode.accept(this);
			if (!expr) {
				exprArgs[i] = new UCEmptyArgument(rangeFromBounds(argNode.start, argNode.stop));
				continue;
			}
			exprArgs[i] = expr;
		}
		return exprArgs;
	}

	visitArgument(ctx: UCGrammar.ArgumentContext): IExpression | undefined {
		const exprNode = ctx.expression();
		return exprNode?.accept(this);
	}

	// primaryExpression [ expression ]
	visitElementAccessExpression(ctx: UCGrammar.ElementAccessExpressionContext) {
		const expression = new UCElementAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

		const primaryNode = ctx.primaryExpression();
		expression.expression = primaryNode.accept(this);
		expression.argument = ctx._arg?.accept(this);
		return expression;
	}

	// new ( arguments ) classArgument=primaryExpression
	visitNewExpression(ctx: UCGrammar.NewExpressionContext) {
		const expression = new UCNewExpression(rangeFromBounds(ctx.start, ctx.stop));

		expression.expression = ctx._expr.accept(this);

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this);
		}
		return expression;
	}

	visitMetaClassExpression(ctx: UCGrammar.MetaClassExpressionContext) {
		const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCObjectTypeSymbol(idFromCtx(classIdNode), undefined, UCTypeFlags.Class);
		}

		if (ctx._expr) {
			expression.expression = ctx._expr.accept(this);
		}
		return expression;
	}

	visitSuperExpression(ctx: UCGrammar.SuperExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSuperExpression(range);

		const superIdNode = ctx.identifier();
		if (superIdNode) {
			expression.structTypeRef = new UCObjectTypeSymbol(idFromCtx(superIdNode));
		}
		return expression;
	}

	visitSelfReferenceExpression(ctx: UCGrammar.SelfReferenceExpressionContext) {
		const expression = new UCPredefinedAccessExpression(idFromCtx(ctx));
		return expression;
	}

	visitDefaultReferenceExpression(ctx: UCGrammar.DefaultReferenceExpressionContext) {
		const expression = new UCPredefinedAccessExpression(idFromCtx(ctx));
		return expression;
	}

	visitStaticAccessExpression(ctx: UCGrammar.StaticAccessExpressionContext) {
		const expression = new UCPredefinedAccessExpression(idFromCtx(ctx));
		return expression;
	}

	visitGlobalAccessExpression(ctx: UCGrammar.GlobalAccessExpressionContext) {
		const expression = new UCPredefinedAccessExpression(idFromCtx(ctx));
		return expression;
	}

    visitSizeOfToken(ctx: UCGrammar.SizeOfTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSizeOfLiteral(range);

		const idNode = ctx.identifier();
		if (idNode) {
			const identifier: Identifier = idFromCtx(idNode);
			expression.argumentRef = new UCObjectTypeSymbol(identifier, undefined, UCTypeFlags.Class);
		}

		return expression;
	}

	visitArrayCountExpression(ctx: UCGrammar.ArrayCountExpressionContext) {
		const expression = new UCArrayCountExpression(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			expression.argument = ctx._expr.accept<IExpression>(this);
		}
		return expression;
	}

	visitArrayCountToken(ctx: UCGrammar.ArrayCountTokenContext) {
		const expression = new UCArrayCountExpression(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			expression.argument = ctx._expr.accept<IExpression>(this);
		}
		return expression;
	}

    visitNameOfToken(ctx: UCGrammar.NameOfTokenContext) {
		const expression = new UCNameOfExpression(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			expression.argument = ctx._expr.accept<IExpression>(this);
		}
		return expression;
	}

    visitNameOfExpression(ctx: UCGrammar.NameOfExpressionContext) {
		const expression = new UCNameOfExpression(rangeFromBounds(ctx.start, ctx.stop));

		if (ctx._expr) {
			expression.argument = ctx._expr.accept<IExpression>(this);
		}
		return expression;
	}

	visitNoneLiteral(ctx: UCGrammar.NoneLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNoneLiteral(range);
		return expression;
	}

	visitStringLiteral(ctx: UCGrammar.StringLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCStringLiteral(range);
		return expression;
	}

	visitNameLiteral(ctx: UCGrammar.NameLiteralContext) {
        const token = ctx.NAME().payload;
        const text = token.text!;
        const name = toName(text.substring(1, text.length - 1));
        const id: Identifier = {
            name: name,
            range: rangeFromBound(token)
        };
		const expression = new UCNameLiteral(id);
		return expression;
	}

	visitBoolLiteral(ctx: UCGrammar.BoolLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCBoolLiteral(range);
		expression.value = Boolean(ctx.text);
		return expression;
	}

	visitFloatLiteral(ctx: UCGrammar.FloatLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCFloatLiteral(range);
		expression.value = Number.parseFloat(ctx.FLOAT().text);
		return expression;
	}

	visitNumberLiteral(ctx: UCGrammar.NumberLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCFloatLiteral(range);
		expression.value = Number.parseFloat(ctx.text);
		return expression;
	}

	visitIntLiteral(ctx: UCGrammar.IntLiteralContext) {
		const rawValue = Number.parseInt(ctx.INTEGER().text);
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new ((rawValue >= 0 && rawValue <= 255) ? UCByteLiteral : UCIntLiteral)(range);
		expression.value = rawValue;
		return expression;
	}

	visitObjectLiteral(ctx: UCGrammar.ObjectLiteralContext) {
		const expression = new UCObjectLiteral(rangeFromBounds(ctx.start, ctx.stop));

		const classIdNode = ctx.identifier();
		const castRef = new UCObjectTypeSymbol(idFromCtx(classIdNode), undefined, UCTypeFlags.Class);
		expression.castRef = castRef;

		const objectIdNode = ctx.NAME();
		const str = objectIdNode.text.replace(/'|\s/g, "");
		const ids = str.split('.');

		const startLine = objectIdNode.symbol.line - 1;
		let startChar = objectIdNode.symbol.charPositionInLine + 1;

		const identifiers: Identifier[] = [];
		for (const id of ids) {
			const identifier: Identifier = {
				name: toName(id),
				range: {
					start: {
						line: startLine,
						character: startChar
					},
					end: {
						line: startLine,
						character: startChar + id.length
					}
				} as Range
			};
			identifiers.push(identifier);

			startChar += id.length + 1;
		}

		const type = typeFromIds(identifiers);
		if (type) {
			expression.objectRef = type;
		}
		return expression;
	}

	visitStructLiteral(ctx: UCGrammar.StructLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCDefaultStructLiteral(range);

		// FIXME: Assign structType

		return expression;
	}

	visitQualifiedIdentifierLiteral(ctx: UCGrammar.QualifiedIdentifierLiteralContext) {
		// TODO: Support
		return undefined;
	}

	visitIdentifierLiteral(ctx: UCGrammar.IdentifierLiteralContext) {
		const expression = new UCIdentifierLiteralExpression(idFromCtx(ctx));
		return expression;
	}

	visitVectToken(ctx: UCGrammar.VectTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCVectLiteral(range);
		return expression;
	}

	visitRotToken(ctx: UCGrammar.RotTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRotLiteral(range);
		return expression;
	}

	visitRngToken(ctx: UCGrammar.RngTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRngLiteral(range);
		return expression;
	}

	protected defaultResult() {
		return undefined;
	}
}