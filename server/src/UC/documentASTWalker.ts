import { Range } from 'vscode-languageserver-types';

import { ANTLRErrorListener, RecognitionException, Recognizer, Token, ParserRuleContext } from 'antlr4ts';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';

import * as UCParser from '../antlr/UCGrammarParser';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds, rangeFromBound } from './helpers';
import {
	toName,
	NAME_CLASS, NAME_ARRAY, NAME_REPLICATION,
	NAME_STRUCTDEFAULTPROPERTIES, NAME_DEFAULTPROPERTIES,
	NAME_NONE, NAME_NAME, NAME_DELEGATE, NAME_ENUMCOUNT,
	NAME_INT, NAME_FLOAT, NAME_BYTE, NAME_STRING,
	NAME_BOOL, NAME_POINTER, NAME_BUTTON
} from './names';

import {
	Identifier, ISymbol, ISymbolContainer, UCConstSymbol,
	UCDefaultPropertiesBlock, UCEnumMemberSymbol, UCEnumSymbol,
	UCMethodSymbol, UCLocalSymbol, UCObjectSymbol,
	UCPropertySymbol, UCScriptStructSymbol, UCStateSymbol,
	UCStructSymbol, UCSymbol, UCSymbolReference,
	ITypeSymbol, UCObjectTypeSymbol, UCQualifiedTypeSymbol,
	UCDocumentClassSymbol, UCReplicationBlock,
	MethodSpecifiers, UCEventSymbol, UCBinaryOperatorSymbol,
	UCDelegateSymbol, UCPostOperatorSymbol, UCPreOperatorSymbol,
	FieldModifiers, ParamModifiers,
	UCParamSymbol, UCTypeKind,
	UCIntTypeSymbol, UCFloatTypeSymbol, UCByteTypeSymbol, UCStringTypeSymbol,
	UCNameTypeSymbol, UCBoolTypeSymbol, UCPointerTypeSymbol, UCButtonTypeSymbol,
	UCDelegateTypeSymbol, UCArrayTypeSymbol, UCMapTypeSymbol
} from './Symbols';

import { SyntaxErrorNode } from './diagnostics/diagnostics';

import {
	UCBlock, IStatement, UCExpressionStatement, UCLabeledStatement,
	UCReturnStatement, UCGotoStatement, UCIfStatement, UCWhileStatement,
	UCDoUntilStatement, UCForEachStatement, UCForStatement, UCSwitchStatement,
	UCCaseClause, UCDefaultClause, UCAssertStatement
} from './statements';

import { setEnumMember } from './indexer';

import { UCDocument } from './document';
import {
	UCAssignmentExpression, IExpression,
	UCConditionalExpression, UCBinaryExpression, UCUnaryExpression,
	UCParenthesizedExpression,
	UCPropertyAccessExpression, UCCallExpression, UCElementAccessExpression,
	UCNewExpression, UCMetaClassExpression, UCSuperExpression,
	UCPredefinedAccessExpression, UCPredefinedPropertyAccessExpression,
	UCMemberExpression,
	UCNoneLiteral, UCStringLiteral, UCNameLiteral,
	UCBoolLiteral, UCFloatLiteral, UCIntLiteral, UCObjectLiteral,
	UCVectLiteral, UCRotLiteral, UCRngLiteral,
	UCNameOfLiteral, UCArrayCountExpression, UCSizeOfLiteral, UCArrayCountLiteral
} from './expressions';

function createIdentifierFrom(ctx: ParserRuleContext) {
	const identifier: Identifier = {
		name: toName(ctx.text),
		range: rangeFromBound(ctx.start)
	};

	return identifier;
}

function createMemberExpressionFromIdentifier(ctx: UCParser.IdentifierContext): UCMemberExpression {
	const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
	expression.context = ctx;
	return expression;
}

function createBlockFromCode(
	visitor: DocumentASTWalker,
	ctx: ParserRuleContext & { statement: () => UCParser.StatementContext[] }
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
		console.error(`An errored ocurred when building statements for a codeblock in scope '${visitor.scope().getQualifiedName()}'!`);
		throw err;
	}
	return block;
}

function createTypeFromIdentifiers(visitor: DocumentASTWalker, identifiers: Identifier[]): ITypeSymbol | undefined {
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

export class DocumentASTWalker extends AbstractParseTreeVisitor<ISymbol | IExpression | IStatement | Identifier | undefined> implements UCGrammarVisitor<any>, ANTLRErrorListener<Token> {
	private scopes: ISymbolContainer<ISymbol>[] = [];

	constructor(private document: UCDocument) {
		super();
		this.scopes.push(document.classPackage);
	}

	push(newContext: UCStructSymbol) {
		this.scopes.push(newContext);
	}

	pop() {
		this.scopes.pop();
	}

	scope<T extends ISymbolContainer<ISymbol> & ISymbol>(): T {
		return <T>this.scopes[this.scopes.length - 1];
	}

	declare(symbol: UCSymbol) {
		const scope = this.scope();
		console.assert(scope, "Tried adding a symbol without a scope!");
		scope.addSymbol(symbol);
	}

	syntaxError(_recognizer: Recognizer<Token, any>,
		offendingSymbol: Token | undefined,
		_line: number,
		_charPositionInLine: number,
		msg: string,
		error: RecognitionException | undefined
	) {
		let range: Range;
		if (error && error.context instanceof ParserRuleContext) {
			range = rangeFromBounds(error.context.start, offendingSymbol!);
		} else {
			range = rangeFromBound(offendingSymbol!);
		}
		const node = new SyntaxErrorNode(range, msg);
		this.document.nodes.push(node);
	}

	visitErrorNode(errNode: ErrorNode) {
		const node = new SyntaxErrorNode(rangeFromBound(errNode.symbol), '(ANTLR Node Error) ' + errNode.text);
		this.document.nodes.push(node);
		return undefined!;
	}

	visitIdentifier(ctx: UCParser.IdentifierContext) {
		const identifier: Identifier = {
			name: toName(ctx.text),
			range: rangeFromBound(ctx.start)
		};

		return identifier;
	}

	visitQualifiedIdentifier(ctx: UCParser.QualifiedIdentifierContext) {
		const idNodes = ctx.identifier();
		if (idNodes.length === 1) {
			const id: Identifier = idNodes[0].accept(this);
			const type = new UCObjectTypeSymbol(id, rangeFromBounds(idNodes[0].start, idNodes[0].stop));

			// FIXME: ugly hardcoded logic
			if (ctx.parent instanceof UCParser.ExtendsClauseContext || ctx.parent instanceof UCParser.WithinClauseContext) {
				if (ctx.parent.parent instanceof UCParser.StructDeclContext) {
					type.setValidTypeKind(UCTypeKind.Struct);
				} else if (ctx.parent.parent instanceof UCParser.StateDeclContext) {
					type.setValidTypeKind(UCTypeKind.State);
				} else {
					type.setValidTypeKind(UCTypeKind.Class);
				}
			}
			return type;
		}

		const leftId: Identifier = idNodes[0].accept(this);
		const leftType = new UCObjectTypeSymbol(leftId, rangeFromBounds(idNodes[0].start, idNodes[0].stop));

		const id: Identifier = idNodes[1].accept(this);
		const type = new UCObjectTypeSymbol(id, rangeFromBounds(idNodes[1].start, idNodes[1].stop));

		const symbol = new UCQualifiedTypeSymbol(type, new UCQualifiedTypeSymbol(leftType));

		// FIXME: ugly hardcoded logic
		if (ctx.parent instanceof UCParser.ExtendsClauseContext || ctx.parent instanceof UCParser.WithinClauseContext) {
			if (ctx.parent.parent instanceof UCParser.StructDeclContext) {
				leftType.setValidTypeKind(UCTypeKind.Class);
				type.setValidTypeKind(UCTypeKind.Struct);
			} else if (ctx.parent.parent instanceof UCParser.StateDeclContext) {
				leftType.setValidTypeKind(UCTypeKind.Class);
				type.setValidTypeKind(UCTypeKind.State);
			} else {
				leftType.setValidTypeKind(UCTypeKind.Package);
				type.setValidTypeKind(UCTypeKind.Class);
			}
		}
		return symbol;
	}

	visitTypeDecl(typeDeclNode: UCParser.TypeDeclContext): ITypeSymbol {
		const rule = typeDeclNode.getChild(0);
		if (rule instanceof UCParser.PredefinedTypeContext) {
			// TODO: Maybe check rule.type instead to save us from hashing a string?
			const name = toName(rule.text);
			const type = name === NAME_BYTE
				? UCByteTypeSymbol
				: name === NAME_FLOAT
				? UCFloatTypeSymbol
				: name === NAME_INT
				? UCIntTypeSymbol
				: name === NAME_STRING
				? UCStringTypeSymbol
				: name === NAME_NAME
				? UCNameTypeSymbol
				: name === NAME_BOOL
				? UCBoolTypeSymbol
				: name === NAME_POINTER
				? UCPointerTypeSymbol
				: name === NAME_BUTTON
				? UCButtonTypeSymbol
				: undefined;

			if (!type) {
				throw "Unknown type for predefinedType() was encountered!";
			}

			const identifier: Identifier = {
				name: name,
				range: rangeFromBounds(rule.start, rule.stop)
			};
			const symbol = new type(identifier);
			return symbol;
		} else if (rule instanceof UCParser.QualifiedIdentifierContext) {
			const symbol: ITypeSymbol = this.visitQualifiedIdentifier(rule);
			return symbol;
		} else if (rule instanceof UCParser.ClassTypeContext) {
			const identifier: Identifier = {
				name: NAME_CLASS,
				range: rangeFromBound(rule.start)
			};
			const symbol = new UCObjectTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));

			const idNode = rule.identifier();
			if (idNode) {
				const identifier = idNode.accept(this);
				symbol.baseType = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Class);
			}
			return symbol;
		} else if (rule instanceof UCParser.ArrayTypeContext) {
			const identifier: Identifier = {
				name: NAME_ARRAY,
				range: rangeFromBound(rule.start)
			};
			const symbol = new UCArrayTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));

			const baseTypeNode = rule.inlinedDeclTypes();
			if (baseTypeNode) {
				const type: ITypeSymbol | undefined = this.visitInlinedDeclTypes(baseTypeNode);
				symbol.baseType = type;
			}
			return symbol;
		} else if (rule instanceof UCParser.DelegateTypeContext) {
			const identifier: Identifier = {
				name: NAME_DELEGATE,
				range: rangeFromBound(rule.start)
			};
			const symbol = new UCDelegateTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
			symbol.setValidTypeKind(UCTypeKind.Delegate);

			const qualifiedNode = rule.qualifiedIdentifier();
			if (qualifiedNode) {
				const type: ITypeSymbol = this.visitQualifiedIdentifier(qualifiedNode);
				symbol.baseType = type;
			}
			return symbol;
		} else if (rule instanceof UCParser.MapTypeContext) {
			const identifier: Identifier = {
				name: toName(rule.text),
				range: rangeFromBound(rule.start)
			};
			const symbol = new UCMapTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
			return symbol;
		}

		throw "Encountered an unknown typeDecl:" + typeDeclNode.toString();
	}

	visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext): ITypeSymbol | undefined {
		const rule = inlinedTypeCtx.getChild(0);
		if (rule instanceof UCParser.TypeDeclContext) {
			return this.visitTypeDecl(rule);
		} else if (rule instanceof UCParser.StructDeclContext) {
			const symbol: UCStructSymbol = this.visitStructDecl(rule);
			const type = new UCObjectTypeSymbol(symbol.id, undefined, UCTypeKind.Struct);
			// noIndex: true, because the struct will be indexed in its own index() call.
			type.setReference(symbol, this.document, undefined, true);
			return type;
		} else if (rule instanceof UCParser.EnumDeclContext) {
			const symbol: UCEnumSymbol = this.visitEnumDecl(rule);
			const type = new UCObjectTypeSymbol(symbol.id, undefined, UCTypeKind.Enum);
			// noIndex: true, because the enum will be indexed in its own index() call.
			type.setReference(symbol, this.document, undefined, true);
			return type;
		}
		return undefined;
	}

	visitExtendsClause(ctx: UCParser.ExtendsClauseContext) {
		const symbol: ISymbol | undefined = ctx.qualifiedIdentifier().accept(this);
		return symbol;
	}

	visitWithinClause(ctx: UCParser.WithinClauseContext) {
		const symbol: ISymbol | undefined = ctx.qualifiedIdentifier().accept(this);
		return symbol;
	}

	visitClassDecl(ctx: UCParser.ClassDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCDocumentClassSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;
		symbol.document = this.document;
		this.document.class = symbol; // Important!, must be assigned before further parsing.

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = extendsNode.accept(this);
		}

		const withinNode = ctx.withinClause();
		if (withinNode) {
			symbol.withinType = withinNode.accept(this);
		}

		const modifierNodes = ctx.classModifier();
		for (let modifierNode of modifierNodes) {
			const idNode = modifierNode.identifier();
			const modifierArgumentNodes = modifierNode.modifierArguments();
			switch (idNode.text.toLowerCase()) {
				case 'dependson': {
					if (modifierArgumentNodes) {
						if (!symbol.dependsOnTypes) {
							symbol.dependsOnTypes = [];
						}
						for (let valueNode of modifierArgumentNodes.modifierValue()) {
							const identifier: Identifier = {
								name: toName(valueNode.text),
								range: rangeFromBounds(valueNode.start, valueNode.stop)
							};
							const typeSymbol = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Class);
							symbol.dependsOnTypes.push(typeSymbol);
						}
					}
					break;
				}
				case 'implements': {
					if (modifierArgumentNodes) {
						if (!symbol.implementsTypes) {
							symbol.implementsTypes = [];
						}
						for (let valueNode of modifierArgumentNodes.modifierValue()) {
							const identifier: Identifier = {
								name: toName(valueNode.text),
								range: rangeFromBounds(valueNode.start, valueNode.stop)
							};
							const typeSymbol = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Class);
							symbol.implementsTypes.push(typeSymbol);
						}
					}
					break;
				}
			}
		}

		this.declare(symbol); // push to package
		this.push(symbol);

		return symbol;
	}

	visitConstDecl(ctx: UCParser.ConstDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCConstSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		// Ensure that all constant declarations are always declared as a top level field (i.e. class)
		this.document.class!.addSymbol(symbol);

		const valueNode = ctx.constValue();
		if (valueNode) {
			symbol.expression = valueNode.accept(this);
		}
		return symbol;
	}

	visitEnumDecl(ctx: UCParser.EnumDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCEnumSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;
		this.declare(symbol);

		this.push(symbol);
		try {
			let count: number = 0;
			const memberNodes = ctx.enumMember();
			for (const memberNode of memberNodes) {
				const memberSymbol = memberNode.accept(this);
				// HACK: overwrite define() outer let.
				memberSymbol.outer = symbol;
				memberSymbol.value = count++;
			}

			// Insert the compiler-generated enum member "EnumCount".
			// TODO: Insert another generated member, e.g. NM_MAX for ENetMode
			const enumCountMember = new UCEnumMemberSymbol({ name: NAME_ENUMCOUNT, range: symbol.getRange() } as Identifier);
			this.declare(enumCountMember);
			enumCountMember.outer = symbol;
			enumCountMember.value = count;
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitEnumMember(ctx: UCParser.EnumMemberContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCEnumMemberSymbol(identifier);
		this.declare(symbol);
		setEnumMember(symbol);
		return symbol;
	}

	visitStructDecl(ctx: UCParser.StructDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCScriptStructSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = this.visitExtendsClause(extendsNode);
		}

		this.declare(symbol);

		this.push(symbol);
		try {
			const memberNodes = ctx.structMember();
			if (memberNodes) for (const member of memberNodes) {
				member.accept<any>(this);
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitReplicationBlock(ctx: UCParser.ReplicationBlockContext) {
		const identifier: Identifier = {
			name: NAME_REPLICATION,
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCReplicationBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);

		const statementNodes = ctx.replicationStatement();
		if (!statementNodes) {
			return;
		}

		const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
		block.statements = Array(statementNodes.length);
		for (var i = 0; i < statementNodes.length; ++i) {
			const statement = statementNodes[i].accept(this);
			block.statements[i] = statement;

			const idNodes = statementNodes[i].identifier();
			if (idNodes) for (const idNode of idNodes) {
				const identifier = idNode.accept(this);

				const symbolRef = new UCSymbolReference(identifier);
				symbolRef.outer = this.document.class;
				symbol.symbolRefs.set(symbolRef.getId(), symbolRef);
			}
		}
		symbol.block = block;
		return symbol;
	}

	visitFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		let nameNode: UCParser.FunctionNameContext | undefined;
		try {
			nameNode = ctx.functionName();
		} catch (err) {
			// Can happen when we have a function with an invalid body or header.
			console.error("Encountered an error with ctx.functioName()", err);
			return;
		} finally {
			console.assert(nameNode, 'no name node found for function!');
		}

		let modifiers: FieldModifiers = 0;
		let specifiers: MethodSpecifiers = MethodSpecifiers.None;
		let precedence: number | undefined;

		const specifierNodes = ctx.functionSpecifier();
		for (const specifier of specifierNodes) {
			switch (specifier.start.type) {
				case UCParser.UCGrammarParser.KW_NATIVE:
					modifiers |= FieldModifiers.Native;
					break;
				case UCParser.UCGrammarParser.KW_CONST:
					modifiers |= FieldModifiers.Const;
					break;
				case UCParser.UCGrammarParser.KW_PROTECTED:
					modifiers |= FieldModifiers.Protected;
					break;
				case UCParser.UCGrammarParser.KW_PRIVATE:
					modifiers |= FieldModifiers.Private;
					break;
				case UCParser.UCGrammarParser.KW_FUNCTION:
					specifiers |= MethodSpecifiers.Function;
					break;
				case UCParser.UCGrammarParser.KW_OPERATOR:
					specifiers |= MethodSpecifiers.Operator;
					const opPrecNode = specifier.operatorPrecedence();
					if (opPrecNode) {
						precedence = Number(opPrecNode.text);
					}
					break;
				case UCParser.UCGrammarParser.KW_PREOPERATOR:
					specifiers |= MethodSpecifiers.PreOperator;
					break;
				case UCParser.UCGrammarParser.KW_POSTOPERATOR:
					specifiers |= MethodSpecifiers.PostOperator;
					break;
				case UCParser.UCGrammarParser.KW_DELEGATE:
					specifiers |= MethodSpecifiers.Delegate;
					break;
				case UCParser.UCGrammarParser.KW_EVENT:
					specifiers |= MethodSpecifiers.Event;
					break;
				case UCParser.UCGrammarParser.KW_STATIC:
					specifiers |= MethodSpecifiers.Static;
					break;
				case UCParser.UCGrammarParser.KW_FINAL:
					specifiers |= MethodSpecifiers.Final;
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
			this.document.nodes.push(new SyntaxErrorNode(rangeFromBound(ctx.start),
				`Method must be declared as either one of the following: (Function, Event, Operator, PreOperator, PostOperator, or Delegate).`
			));
		}

		const range = rangeFromBounds(ctx.start, ctx.stop);
		const identifier: Identifier = nameNode.accept(this);
		const symbol = new type(identifier, range);
		symbol.context = ctx;
		symbol.specifiers = specifiers;
		symbol.modifiers = modifiers;

		if (precedence) {
			(symbol as UCBinaryOperatorSymbol).precedence = precedence;
		}

		this.declare(symbol);

		const returnTypeNode = ctx.returnType();
		if (returnTypeNode) {
			symbol.returnType = this.visitTypeDecl(returnTypeNode.typeDecl());
		}

		this.push(symbol);
		try {
			const paramsNode = ctx.parameters();
			if (paramsNode) {
				// TODO: do away with member @params
				symbol.params = [];
				const paramNodes = paramsNode.paramDecl();
				for (const paramNode of paramNodes) {
					const propSymbol = paramNode.accept<any>(this);
					symbol.params.push(propSymbol);
				}
			}

			const bodyNode = ctx.functionBody();
			if (bodyNode) {
				bodyNode.accept(this);
			}
		} catch (err) {
			console.error(`Encountered an error while constructing function '${symbol.getQualifiedName()}'`, err);
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitFunctionBody(ctx: UCParser.FunctionBodyContext) {
		const memberNodes = ctx.functionMember();
		if (memberNodes) for (const member of memberNodes) {
			member.accept(this);
		}

		const method = this.scope<UCMethodSymbol>();
		method.block = createBlockFromCode(this, ctx);
	}

	// visitFunctionMember(ctx: UCParser.FunctionMemberContext) {
	// 	const symbol = ctx.getChild(0).accept(this);
	// 	return symbol;
	// }

	// visitStateMember(ctx: UCParser.StateMemberContext) {
	// 	const symbol = ctx.getChild(0).accept(this);
	// 	return symbol;
	// }

	// visitStructMember(ctx: UCParser.StructMemberContext) {
	// 	const symbol = ctx.getChild(0).accept(this);
	// 	return symbol;
	// }

	visitParamDecl(ctx: UCParser.ParamDeclContext) {
		let modifiers: FieldModifiers = 0;
		let paramModifiers: ParamModifiers = 0;
		const modifierNodes = ctx.paramModifier();
		for (const modNode of modifierNodes) {
			switch (modNode.start.type) {
				case UCParser.UCGrammarParser.KW_CONST:
					modifiers |= FieldModifiers.Const;
					break;
				case UCParser.UCGrammarParser.KW_OUT:
					paramModifiers |= ParamModifiers.Out;
					break;
				case UCParser.UCGrammarParser.KW_OPTIONAL:
					paramModifiers |= ParamModifiers.Optional;
					break;
				case UCParser.UCGrammarParser.KW_COERCE:
					paramModifiers |= ParamModifiers.Coerce;
					break;
			}
		}

		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNode = ctx.variable();

		const identifier: Identifier = varNode.identifier().accept(this);
		const symbol = new UCParamSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.type = typeSymbol;
		symbol.modifiers = modifiers;
		symbol.paramModifiers = paramModifiers;

		const exprNode = ctx.expression();
		if (exprNode) {
			symbol.defaultExpression = exprNode.accept(this);
		}

		symbol.walk(this, varNode);
		this.declare(symbol);
		return symbol;
	}

	visitLocalDecl(ctx: UCParser.LocalDeclContext) {
		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNodes = ctx.variable();
		for (const varNode of varNodes) {
			const symbol: UCLocalSymbol = varNode.accept(this);
			symbol.type = typeSymbol;
			this.declare(symbol);
		}
		return undefined;
	}

	visitVarDecl(ctx: UCParser.VarDeclContext) {
		const declTypeNode = ctx.inlinedDeclTypes();
		if (!declTypeNode) {
			return;
		}

		let modifiers: FieldModifiers = 0;
		const modifierNodes = ctx.variableModifier();
		for (const modNode of modifierNodes) {
			switch (modNode.start.type) {
				case UCParser.UCGrammarParser.KW_CONST:
					modifiers |= FieldModifiers.Const;
					break;
				case UCParser.UCGrammarParser.KW_NATIVE:
					modifiers |= FieldModifiers.Native;
					break;
				case UCParser.UCGrammarParser.KW_PROTECTED:
					modifiers |= FieldModifiers.Protected;
					break;
				case UCParser.UCGrammarParser.KW_PRIVATE:
					modifiers |= FieldModifiers.Private;
					break;
			}
		}

		const typeSymbol = this.visitInlinedDeclTypes(declTypeNode);
		const varNodes = ctx.variable();
		if (varNodes) for (const varNode of varNodes) {
			const symbol: UCPropertySymbol = varNode.accept(this);
			symbol.context = varNode;
			symbol.type = typeSymbol;
			symbol.modifiers = modifiers;
			this.declare(symbol);
		}
		return undefined!;
	}

	visitVariable(ctx: UCParser.VariableContext) {
		const type = ctx.parent instanceof UCParser.LocalDeclContext
			? UCLocalSymbol
			: UCPropertySymbol;

		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol: UCPropertySymbol = new type(
			identifier,
			// Stop at varCtx instead of localCtx for multiple variable declarations.
			rangeFromBounds(ctx.parent!.start, ctx.stop)
		);
		symbol.walk(this, ctx);
		return symbol;
	}

	visitStateDecl(ctx: UCParser.StateDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);

		const symbol = new UCStateSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = this.visitExtendsClause(extendsNode);
		}

		this.declare(symbol);

		this.push(symbol);
		try {
			const memberNodes = ctx.stateMember();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
			symbol.block = createBlockFromCode(this, ctx);
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitIgnoresDecl(ctx: UCParser.IgnoresDeclContext) {
		const scope = this.scope<UCStateSymbol>();
		if (!scope.ignoreRefs) {
			scope.ignoreRefs = [];
		}
		const idNodes = ctx.identifier();
		for (const idNode of idNodes) {
			const identifier: Identifier = idNode.accept(this);
			const ref = new UCSymbolReference(identifier);
			scope.ignoreRefs.push(ref);
		}
		return undefined;
	}

	visitDefaultStatement(ctx: UCParser.DefaultStatementContext) {
		return this.visitChildren(ctx);
	}

	visitStructDefaultPropertiesBlock(ctx: UCParser.StructDefaultPropertiesBlockContext) {
		const identifier: Identifier = {
			name: NAME_STRUCTDEFAULTPROPERTIES,
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCDefaultPropertiesBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		try {
			const memberNodes = ctx.defaultStatement();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitDefaultPropertiesBlock(ctx: UCParser.DefaultPropertiesBlockContext) {
		const identifier: Identifier = {
			name: NAME_DEFAULTPROPERTIES,
			range: rangeFromBound(ctx.start)
		};

		const symbol = new UCDefaultPropertiesBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		try {
			const memberNodes = ctx.defaultStatement();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitObjectDecl(ctx: UCParser.ObjectDeclContext) {
		const identifier: Identifier = {
			name: NAME_NONE,
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCObjectSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		try {
			const memberNodes = ctx.defaultStatement();
			if (memberNodes) for (const member of memberNodes) {
				member.accept(this);
			}
		} finally {
			this.pop();
		}
		return symbol;
	}

	visitDefaultVariable(ctx: UCParser.DefaultVariableContext) {
		const identifier: Identifier = ctx.defaultId().accept(this);
		const scope = this.scope<UCObjectSymbol>();

		const symbolRef = new UCSymbolReference(identifier);
		symbolRef.outer = scope;

		const propId = symbolRef.getId();
		switch (propId) {
			case NAME_NAME: {
				// TODO: change name
			}

			case NAME_CLASS: {
				const typeSymbol = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Class);
				scope.extendsType = typeSymbol;
			}
		}
		scope.symbolRefs.set(propId, symbolRef);

		const valueNode = ctx.defaultValue();
		if (valueNode) {
			const literalNode = valueNode.defaultLiteral();
			const structNode = literalNode!.structLiteral();
			if (structNode) {
				const objSymbol = structNode.accept(this);
				objSymbol.outer = scope;
			}
		}
		return scope;
	}

	visitStructLiteral(ctx: UCParser.StructLiteralContext) {
		const identifier: Identifier = {
			name: NAME_NONE,
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCObjectSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		this.push(symbol);
		// TODO: members
		this.pop();
		return symbol;
	}

	visitDefaultId(ctx: UCParser.DefaultIdContext) {
		return createIdentifierFrom(ctx);
	}

	visitFunctionName(ctx: UCParser.FunctionNameContext): Identifier {
		const opNode = ctx.operator();
		if (opNode) {
			const identifier: Identifier = {
				name: toName(opNode.text),
				range: rangeFromBounds(opNode.start, opNode.stop)
			};
			return identifier;
		}

		const idNode = ctx.identifier();
		if (idNode) {
			return idNode.accept(this);
		}
		return { name: NAME_NONE, range: rangeFromBounds(ctx.start, ctx.stop) } as Identifier;
	}

	visitStatement(ctx: UCParser.StatementContext) {
		if (ctx.childCount === 0) {
			return undefined!;
		}

		return ctx.getChild(0).accept(this);
	}

	visitExpressionStatement(ctx: UCParser.ExpressionStatementContext) {
		const statement = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;
		statement.expression = ctx.expression().accept(this);
		return statement;
	}

	visitLabeledStatement(ctx: UCParser.LabeledStatementContext): UCLabeledStatement {
		const statement = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
		const idNode = ctx.identifier();
		if (idNode) {
			statement.label = idNode.text;
		}
		statement.context = ctx;
		return statement;
	}

	visitReturnStatement(ctx: UCParser.ReturnStatementContext): IStatement {
		const statement = new UCReturnStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}
		return statement;
	}

	visitGotoStatement(ctx: UCParser.GotoStatementContext): IStatement {
		const statement = new UCGotoStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}
		return statement;
	}

	visitReplicationStatement(ctx: UCParser.ReplicationStatementContext): UCIfStatement {
		const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}
		return statement;
	}

	visitWhileStatement(ctx: UCParser.WhileStatementContext): UCWhileStatement {
		const statement = new UCWhileStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = createBlockFromCode(this, blockNode);
		}
		return statement;
	}

	visitIfStatement(ctx: UCParser.IfStatementContext): UCIfStatement {
		const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = createBlockFromCode(this, blockNode);
		}

		const elseStatementNode = ctx.elseStatement();
		if (elseStatementNode) {
			statement.else = elseStatementNode.accept(this);
		}
		return statement;
	}

	visitElseStatement(ctx: UCParser.ElseStatementContext) {
		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			return createBlockFromCode(this, blockNode);
		}
		return undefined;
	}

	visitDoStatement(ctx: UCParser.DoStatementContext): UCDoUntilStatement {
		const statement = new UCDoUntilStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = createBlockFromCode(this, blockNode);
		}
		return statement;
	}

	visitForeachStatement(ctx: UCParser.ForeachStatementContext): UCForEachStatement {
		const statement = new UCForEachStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			statement.expression = exprNode.accept<any>(this);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = createBlockFromCode(this, blockNode);
		}
		return statement;
	}

	visitForStatement(ctx: UCParser.ForStatementContext): UCForStatement {
		const statement = new UCForStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		let exprNode = ctx.expression(0);
		if (exprNode) {
			statement.init = exprNode.accept(this);
		}

		exprNode = ctx.expression(1);
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}

		exprNode = ctx.expression(2);
		if (exprNode) {
			statement.next = exprNode.accept(this);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = createBlockFromCode(this, blockNode);
		}
		return statement;
	}

	visitSwitchStatement(ctx: UCParser.SwitchStatementContext): IStatement {
		const statement = new UCSwitchStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}

		const clauseNodes: ParserRuleContext[] = ctx.caseClause() || [];
		const defaultClauseNode = ctx.defaultClause();

		if (defaultClauseNode) {
			clauseNodes.push(defaultClauseNode);
		}

		const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
		block.statements = Array(clauseNodes.length);
		for (var i = 0; i < clauseNodes.length; ++i) {
			const caseStatement: IStatement = clauseNodes[i].accept<any>(this);
			block.statements[i] = caseStatement;
		}
		statement.then = block;

		return statement;
	}

	visitCaseClause(ctx: UCParser.CaseClauseContext): IStatement {
		const statement = new UCCaseClause(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}
		statement.then = createBlockFromCode(this, ctx);
		return statement;
	}

	visitDefaultClause(ctx: UCParser.DefaultClauseContext) {
		const statement = new UCDefaultClause(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;
		statement.then = createBlockFromCode(this, ctx);
		return statement;
	}

	visitAssertStatement(ctx: UCParser.AssertStatementContext): IStatement {
		const statement = new UCAssertStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(this);
		}
		return statement;
	}

	visitAssignmentExpression(ctx: UCParser.AssignmentExpressionContext) {
		const expression = new UCAssignmentExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		expression.left = primaryNode.accept<any>(this);
		expression.left!.outer = expression;

		const operatorNode = ctx.assignmentOperator();
		expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.right = exprNode.accept(this);
			expression.right!.outer = expression;
		}
		return expression;
	}

	visitConditionalExpression(ctx: UCParser.ConditionalExpressionContext) {
		const expression = new UCConditionalExpression();
		expression.context = ctx;

		const conditionNode = ctx.unaryExpression();
		if (conditionNode) {
			expression.condition = conditionNode.accept(this);
			expression.condition.outer = expression;
		}

		const leftNode = ctx.expression(0);
		if (leftNode) {
			expression.true = leftNode.accept(this);
			expression.true!.outer = expression;
		}

		const rightNode = ctx.expression(1);
		if (rightNode) {
			expression.false = rightNode.accept(this);
			expression.false!.outer = expression;
		}
		return expression;
	}

	visitBinaryExpression(ctx: UCParser.BinaryExpressionContext) {
		const expression = new UCBinaryExpression();
		expression.context = ctx;

		const leftNode = ctx.unaryExpression();
		expression.left = leftNode.accept(this);
		expression.left!.outer = expression;

		const operatorNode = ctx.functionName();
		expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));

		const rightNode = ctx.expression();
		if (rightNode) {
			expression.right = rightNode.accept<any>(this);
			expression.right!.outer = expression;
		}
		return expression;
	}

	visitUnaryExpression(ctx: UCParser.UnaryExpressionContext) {
		const operatorNode = ctx.unaryOperator();
		if (operatorNode) {
			const expression = new UCUnaryExpression();
			expression.context = ctx;

			const primaryNode = ctx.primaryExpression();
			expression.expression = primaryNode.accept<any>(this);
			expression.expression.outer = expression;
			expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
			return expression;
		}

		const primaryNode = ctx.primaryExpression();
		const expression = primaryNode.accept<any>(this);
		expression.outer = expression;
		return expression;
	}

	visitParenthesizedExpression(ctx: UCParser.ParenthesizedExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept<any>(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitPropertyAccessExpression(ctx: UCParser.PropertyAccessExpressionContext) {
		const expression = new UCPropertyAccessExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept<any>(this);
			expression.left!.outer = expression;
		}

		const idNode = ctx.identifier();
		expression.member = createMemberExpressionFromIdentifier(idNode);
		expression.member.outer = expression;
		return expression;

		const specNode = ctx.classPropertyAccessSpecifier();
		if (specNode) {
			// TODO: recognize this particular kind of a propertyAccessExpression
		}
	}

	visitMemberExpression(ctx: UCParser.MemberExpressionContext) {
		return createMemberExpressionFromIdentifier(ctx.identifier());
	}

	visitCallExpression(ctx: UCParser.CallExpressionContext) {
		const expression = new UCCallExpression();
		expression.context = ctx;

		// expr ( arguments )
		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<any>(this);
			expression.expression!.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this);
			if (expression.arguments) for (let i = 0; i < expression.arguments.length; ++i) {
				if (expression.arguments[i]) {
					expression.arguments[i]!.outer = expression;
				}
			}
		}
		return expression;
	}

	visitArguments(ctx: UCParser.ArgumentsContext): IExpression[] | undefined {
		const argumentNodes = ctx.argument();
		if (!argumentNodes) {
			return undefined;
		}

		const exprArgs = new Array(argumentNodes.length);
		for (let i = 0; i < exprArgs.length; ++i) {
			exprArgs[i] = argumentNodes[i].accept(this);
		}
		return exprArgs;
	}

	visitArgument(ctx: UCParser.ArgumentContext): IExpression | undefined {
		const exprNode = ctx.expression();
		if (exprNode) {
			return exprNode.accept(this);
		}
		return undefined;
	}

	// primaryExpression [ expression ]
	visitElementAccessExpression(ctx: UCParser.ElementAccessExpressionContext) {
		const expression = new UCElementAccessExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.expression = primaryNode.accept<any>(this);
			expression.expression!.outer = expression;
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.argument = exprNode.accept<any>(this);
			expression.argument!.outer = expression;
		}
		return expression;
	}

	// new ( arguments ) classArgument
	visitNewExpression(ctx: UCParser.NewExpressionContext) {
		const expression = new UCNewExpression();
		expression.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<any>(this);
			expression.expression!.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this);
			if (expression.arguments) for (let i = 0; i < expression.arguments.length; ++i) {
				if (expression.arguments[i]) {
					expression.arguments[i]!.outer = expression;
				}
			}
		}
		return expression;
	}

	visitMetaClassExpression(ctx: UCParser.MetaClassExpressionContext) {
		const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCObjectTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitSuperExpression(ctx: UCParser.SuperExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSuperExpression(range);
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCObjectTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
		}
		return expression;
	}

	visitSelfReferenceExpression(ctx: UCParser.SelfReferenceExpressionContext) {
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitDefaultReferenceExpression(ctx: UCParser.DefaultReferenceExpressionContext) {
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitStaticAccessExpression(ctx: UCParser.StaticAccessExpressionContext) {
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitGlobalAccessExpression(ctx: UCParser.GlobalAccessExpressionContext) {
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitClassPropertyAccessSpecifier(ctx: UCParser.ClassPropertyAccessSpecifierContext) {
		const expression = new UCPredefinedPropertyAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitOperator(ctx: UCParser.OperatorContext): UCMemberExpression {
		const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitUnaryOperator(ctx: UCParser.UnaryOperatorContext) {
		const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitArrayCountExpression(ctx: UCParser.ArrayCountExpressionContext) {
		const expression = new UCArrayCountExpression();
		expression.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<any>(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitArrayCountToken(ctx: UCParser.ArrayCountTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCArrayCountLiteral(range);
		expression.context = ctx;

		const idNode = ctx.identifier();
		if (idNode) {
			const identifier: Identifier = idNode.accept(this);
			expression.argumentRef = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Property);
		}

		return expression;
	}

	visitSizeOfToken(ctx: UCParser.SizeOfTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSizeOfLiteral(range);
		expression.context = ctx;

		const idNode = ctx.identifier();
		if (idNode) {
			const identifier: Identifier = idNode.accept(this);
			expression.argumentRef = new UCObjectTypeSymbol(identifier, undefined, UCTypeKind.Class);
		}

		return expression;
	}

	visitNoneLiteral(ctx: UCParser.NoneLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNoneLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitStringLiteral(ctx: UCParser.StringLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCStringLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitNameLiteral(ctx: UCParser.NameLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNameLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitBoolLiteral(ctx: UCParser.BoolLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCBoolLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitFloatLiteral(ctx: UCParser.NumberLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCFloatLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitIntLiteral(ctx: UCParser.IntLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCIntLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitObjectLiteral(ctx: UCParser.ObjectLiteralContext) {
		const expression = new UCObjectLiteral(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		const castRef = new UCSymbolReference(createIdentifierFrom(classIdNode));
		expression.castRef = castRef;

		const objectIdNode = ctx.NAME();
		const str = objectIdNode.text.replace(/'|\s/g, "");
		const ids = str.split('.');

		const startLine = objectIdNode.symbol.line - 1;
		let startChar = objectIdNode.symbol.charPositionInLine + 1;

		const identifiers: Identifier[] = [];
		for (let id of ids) {
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

		const type = createTypeFromIdentifiers(this, identifiers);
		if (type) {
			expression.objectRef = type;
		}
		return expression;
	}

	visitVectToken(ctx: UCParser.VectTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCVectLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitRotToken(ctx: UCParser.RotTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRotLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitRngToken(ctx: UCParser.RngTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRngLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitNameOfToken(ctx: UCParser.NameOfTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNameOfLiteral(range);
		expression.context = ctx;
		const idNode = ctx.identifier();
		if (idNode) {
			expression.argumentRef = new UCObjectTypeSymbol(createIdentifierFrom(idNode), undefined, UCTypeKind.Object);
		}
		return expression;
	}

	protected defaultResult() {
		return undefined;
	}
}