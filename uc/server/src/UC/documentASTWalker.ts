import { Range } from 'vscode-languageserver-types';

import { ANTLRErrorListener, RecognitionException, Recognizer, Token, ParserRuleContext } from 'antlr4ts';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';

import * as UCParser from '../antlr/UCGrammarParser';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds, rangeFromBound } from './helpers';
import { toName, NAME_CLASS, NAME_ARRAY, NAME_REPLICATION, NAME_STRUCTDEFAULTPROPERTIES, NAME_DEFAULTPROPERTIES, NAME_NONE, NAME_NAME, NAME_DELEGATE } from './names';

import {
	Identifier, ISymbol, ISymbolContainer, UCConstSymbol, UCDefaultPropertiesBlock,
	UCEnumMemberSymbol, UCEnumSymbol, UCMethodSymbol,
	UCLocalSymbol, UCObjectSymbol,
	UCPropertySymbol, UCScriptStructSymbol, UCStateSymbol,
	UCStructSymbol, UCSymbol, UCSymbolReference,
	UCTypeSymbol,
	UCDocumentClassSymbol, UCReplicationBlock,
	UCQualifiedType, ITypeSymbol, UCPredefinedTypeSymbol
} from './Symbols';

import { UCTypeKind } from './Symbols/TypeKind';

import { SyntaxErrorNode } from './diagnostics/diagnostics';

import { UCBlock, IStatement, UCExpressionStatement, UCLabeledStatement, UCReturnStatement, UCGotoStatement, UCIfStatement, UCWhileStatement, UCDoUntilStatement, UCForEachStatement, UCForStatement, UCSwitchStatement, UCCaseClause, UCDefaultClause, UCAssertStatement } from './statements';
import { setEnumMember } from './indexer';

import { UCDocument } from './document';
import { UCAssignmentExpression, IExpression, UCConditionalExpression, UCBinaryExpression, UCUnaryExpression, UCParenthesizedExpression, UCPropertyAccessExpression, UCCallExpression, UCElementAccessExpression, UCNewExpression, UCMetaClassExpression, UCSuperExpression, UCPredefinedAccessExpression, UCPredefinedPropertyAccessExpression, UCMemberExpression, UCNoneLiteral, UCStringLiteral, UCNameLiteral, UCBoolLiteral, UCFloatLiteral, UCIntLiteral, UCObjectLiteral, UCVectLiteral, UCRotLiteral, UCRngLiteral, UCNameOfLiteral } from './expressions';
import { UCQualifiedTypeSymbol } from './Symbols/TypeSymbol';

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

function createBlockFromCode(visitor: DocumentASTWalker, ctx: UCParser.CodeBlockOptionalContext | UCParser.CaseClauseContext | UCParser.DefaultClauseContext): UCBlock {
	const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
	const statementNodes = ctx.statement();
	if (statementNodes) {
		block.statements = new Array(statementNodes.length);
		for (var i = 0; i < statementNodes.length; ++ i) {
			const statement: IStatement = statementNodes[i].accept(visitor);
			block.statements[i] = statement;
		}
	}
	return block;
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

	scope<T extends ISymbolContainer<ISymbol>>(): T {
		return <T>this.scopes[this.scopes.length - 1];
	}

	declare(symbol: UCSymbol) {
		const scope = this.scope();
		if (!scope) {
			throw "Tried adding a symbol without a scope!";
		}
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
		const scope = this.scope<UCStructSymbol>(); // FIXME: necessary?
		const idNodes = ctx.identifier();
		if (idNodes.length === 2) {
			const leftId: Identifier = idNodes[0].accept(this);
			const leftType = new UCTypeSymbol(leftId, rangeFromBounds(idNodes[0].start, idNodes[0].stop));
			leftType.outer = scope;

			const id: Identifier = idNodes[1].accept(this);
			const type = new UCTypeSymbol(id, rangeFromBounds(idNodes[1].start, idNodes[1].stop));
			type.outer = scope;

			const symbol = new UCQualifiedType(type, new UCQualifiedType(leftType));
			symbol.outer = scope;

			// FIXME: ugly hardcoded logic
			if (ctx.parent instanceof UCParser.ExtendsClauseContext || ctx.parent instanceof UCParser.WithinClauseContext) {
				if (ctx.parent.parent instanceof UCParser.StructDeclContext) {
					leftType.setTypeKind(UCTypeKind.Class);
					type.setTypeKind(UCTypeKind.Struct);
				} else if (ctx.parent.parent instanceof UCParser.StateDeclContext) {
					leftType.setTypeKind(UCTypeKind.Class);
					type.setTypeKind(UCTypeKind.State);
				} else {
					leftType.setTypeKind(UCTypeKind.Package);
					type.setTypeKind(UCTypeKind.Class);
				}
			}

			return symbol;
		} else if (idNodes.length === 1) {
			const id: Identifier = idNodes[0].accept(this);
			const type = new UCTypeSymbol(id, rangeFromBounds(idNodes[0].start, idNodes[0].stop));
			type.outer = scope;

			// FIXME: ugly hardcoded logic
			if (ctx.parent instanceof UCParser.ExtendsClauseContext || ctx.parent instanceof UCParser.WithinClauseContext) {
				if (ctx.parent.parent instanceof UCParser.StructDeclContext) {
					type.setTypeKind(UCTypeKind.Struct);
				} else if (ctx.parent.parent instanceof UCParser.StateDeclContext) {
					type.setTypeKind(UCTypeKind.State);
				} else {
					type.setTypeKind(UCTypeKind.Class);
				}
			}
			return type;
		} else {
			return undefined;
		}
	}

	visitMember(ctx: UCParser.MemberContext) {
		const symbol = ctx.getChild(0).accept(this);
		return symbol;
	}

	visitTypeDecl(typeDeclNode: UCParser.TypeDeclContext): ITypeSymbol {
		const typeNode = typeDeclNode.predefinedType();
		if (typeNode) {
			const identifier: Identifier = {
				name: toName(typeNode.text),
				range: rangeFromBounds(typeNode.start, typeNode.stop)
			};
			const symbol = new UCPredefinedTypeSymbol(identifier);
			symbol.outer = this.scope<UCStructSymbol>(); // FIXME: necessary?
			return symbol;
		}

		const qualifiedNode = typeDeclNode.qualifiedIdentifier();
		if (qualifiedNode) {
			const symbol = qualifiedNode.accept(this);
			return symbol;
		}

		const classTypeNode = typeDeclNode.classType();
		if (classTypeNode) {
			const identifier: Identifier = {
				name: NAME_CLASS,
				range: rangeFromBound(classTypeNode.start)
			};
			const symbol = new UCTypeSymbol(identifier, rangeFromBounds(classTypeNode.start, classTypeNode.stop));
			symbol.outer = this.scope<UCStructSymbol>();

			const idNode = classTypeNode.identifier();
			if (idNode) {
				const identifier = idNode.accept(this);
				symbol.baseType = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
				symbol.baseType.outer = symbol;
			}
			return symbol;
		}

		const arrayTypeNode = typeDeclNode.arrayType();
		if (arrayTypeNode) {
			const identifier: Identifier = {
				name: NAME_ARRAY,
				range: rangeFromBound(arrayTypeNode.start)
			};
			const symbol = new UCTypeSymbol(identifier, rangeFromBounds(arrayTypeNode.start, arrayTypeNode.stop));
			symbol.outer = this.scope<UCStructSymbol>();

			const baseTypeNode = arrayTypeNode.inlinedDeclTypes();
			if (baseTypeNode && (symbol.baseType = this.visitInlinedDeclTypes(baseTypeNode) as UCTypeSymbol)) {
				symbol.baseType.outer = symbol;
			}
			return symbol;
		}

		const delegateTypeNode = typeDeclNode.delegateType();
		if (delegateTypeNode) {
			const identifier: Identifier = {
				name: NAME_DELEGATE,
				range: rangeFromBound(delegateTypeNode.start)
			};
			const symbol = new UCTypeSymbol(identifier, rangeFromBounds(delegateTypeNode.start, delegateTypeNode.stop));
			symbol.outer = this.scope<UCStructSymbol>();

			const idNode = delegateTypeNode.identifier();
			if (idNode) {
				const identifier = idNode.accept(this);
				symbol.baseType = new UCTypeSymbol(identifier, undefined, UCTypeKind.Delegate);
				symbol.baseType.outer = symbol;
			}
			return symbol;
		}

		const identifier: Identifier = {
			name: toName(typeDeclNode.text),
			range: rangeFromBound(typeDeclNode.start)
		};
		const symbol = new UCTypeSymbol(identifier, rangeFromBounds(typeDeclNode.start, typeDeclNode.stop));
		symbol.outer = this.scope<UCStructSymbol>();
		return symbol;
	}

	visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext): ITypeSymbol | undefined {
		const structDeclNode = inlinedTypeCtx.structDecl();
		if (structDeclNode) {
			structDeclNode.accept(this);
			const structIdentifier = structDeclNode.identifier().accept(this);
			return new UCTypeSymbol(structIdentifier, undefined, UCTypeKind.Struct);
		}

		const enumDeclNode = inlinedTypeCtx.enumDecl();
		if (enumDeclNode) {
			enumDeclNode.accept(this);
			const enumIdentifier = enumDeclNode.identifier().accept(this);
			return new UCTypeSymbol(enumIdentifier, undefined, UCTypeKind.Enum);
		}

		const typeDeclNode = inlinedTypeCtx.typeDecl();
		if (typeDeclNode) {
			return this.visitTypeDecl(typeDeclNode);
		}
		return undefined;
	}

	visitExtendsClause(ctx: UCParser.ExtendsClauseContext) {
		const symbol = ctx.qualifiedIdentifier().accept(this);
		return symbol;
	}

	visitWithinClause(ctx: UCParser.WithinClauseContext) {
		const symbol = ctx.qualifiedIdentifier().accept(this);
		return symbol;
	}

	visitClassDecl(ctx: UCParser.ClassDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCDocumentClassSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;
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
							const typeSymbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
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
							const typeSymbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
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
		const identifier = ctx.identifier().accept(this);
		const symbol = new UCConstSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		// Ensure that all constant declarations are always declared as a top level field (i.e. class)
		this.document.class!.addSymbol(symbol);

		// TODO: create a constantToken walker similar to what we do with expressions.
		const valueNode = ctx.constValue();
		if (valueNode) {
			symbol.value = valueNode.text;
		}

		return symbol;
	}

	visitEnumDecl(ctx: UCParser.EnumDeclContext) {
		const identifier = ctx.identifier().accept(this);
		const symbol = new UCEnumSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);

		this.push(symbol);
		var count = 0;
		const memberNodes = ctx.enumMember();
		for (const memberNode of memberNodes) {
			const memberSymbol = memberNode.accept(this);
			// HACK: overwrite define() outer let.
			memberSymbol.outer = symbol;
			memberSymbol.value = count ++;
		}
		this.pop();
		return symbol;
	}

	visitEnumMember(ctx: UCParser.EnumMemberContext) {
		const identifier = ctx.identifier().accept(this);
		const symbol = new UCEnumMemberSymbol(identifier);
		this.declare(symbol);
		setEnumMember(symbol);
		return symbol;
	}

	visitStructDecl(ctx: UCParser.StructDeclContext) {
		const identifier = ctx.identifier().accept(this);
		const symbol = new UCScriptStructSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = this.visitExtendsClause(extendsNode);
		}

		this.declare(symbol);

		this.push(symbol);
		const members = ctx.structMember();
		if (members) for (const member of members) {
			member.accept<any>(this);
		}
		this.pop();

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
		for (var i = 0; i < statementNodes.length; ++ i) {
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
		const identifier: Identifier = ctx.functionName()!.accept(this);
		const symbol = new UCMethodSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);

		const returnTypeNode = ctx.returnType();
		if (returnTypeNode) {
			symbol.returnType = this.visitTypeDecl(returnTypeNode.typeDecl());
		}

		this.push(symbol);
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

		const members = ctx.functionMember();
		if (members) for (const member of members) {
			member.accept<any>(this);
		}

		const statementNodes = ctx.statement();
		if (statementNodes) {
			symbol.block = this.visitStatements(ctx, statementNodes);
		}
		this.pop();
		return symbol;
	}

	visitFunctionMember(ctx: UCParser.FunctionMemberContext) {
		const symbol = ctx.getChild(0).accept(this);
		return symbol;
	}

	visitStateMember(ctx: UCParser.StateMemberContext) {
		const symbol = ctx.getChild(0).accept(this);
		return symbol;
	}

	visitStructMember(ctx: UCParser.StructMemberContext) {
		const symbol = ctx.getChild(0).accept(this);
		return symbol;
	}

	visitParamDecl(ctx: UCParser.ParamDeclContext) {
		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNode = ctx.variable();
		const symbol = varNode.accept(this);
		symbol.type = typeSymbol;
		this.declare(symbol);
		return symbol;
	}

	visitLocalDecl(ctx: UCParser.LocalDeclContext) {
		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNodes = ctx.variable();
		for (const varNode of varNodes) {
			const symbol = varNode.accept(this);
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

		const typeSymbol = this.visitInlinedDeclTypes(declTypeNode);

		const varNodes = ctx.variable();
		if (varNodes) for (const varNode of varNodes) {
			const symbol = varNode.accept(this);
			symbol.context = varNode;
			symbol.type = typeSymbol;
			this.declare(symbol);

			// FIXME: is this still necessary?
			if (typeSymbol) {
				typeSymbol.outer = symbol.outer; // FIXME: Assign to current context instead.
			}
		}
		return undefined!;
	}

	visitVariable(ctx: UCParser.VariableContext) {
		const scope = this.scope();
		const type = scope instanceof UCMethodSymbol ? UCLocalSymbol : UCPropertySymbol;

		const identifier = ctx.identifier().accept(this);
		const symbol = new type(
			identifier,
			// Stop at varCtx instead of localCtx for multiple variable declarations.
			rangeFromBounds(ctx.parent!.start, ctx.stop)
		);
		const arrayDimNode = ctx.arrayDim();
		if (arrayDimNode) {
			symbol.arrayDim = arrayDimNode.text;
		}
		return symbol;
	}

	visitStatements(ctx: ParserRuleContext, nodes: UCParser.StatementContext[]) {
		const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
		block.statements = Array(nodes.length);
		for (var i = 0; i < nodes.length; ++ i) {
			const statement = nodes[i].accept(this);
			block.statements[i] = statement;
		}
		return block;
	}

	visitStateDecl(ctx: UCParser.StateDeclContext) {
		const identifier = ctx.identifier().accept(this);

		const symbol = new UCStateSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = this.visitExtendsClause(extendsNode);
		}

		this.declare(symbol);

		this.push(symbol);
		const members = ctx.stateMember();
		if (members) for (const member of members) {
			member.accept(this);
		}

		const statementNodes = ctx.statement();
		if (statementNodes) {
			symbol.block = this.visitStatements(ctx, statementNodes);
		}
		this.pop();

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
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept(this);
		}
		this.pop();
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
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept(this);
		}
		this.pop();
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
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept(this);
		}
		this.pop();
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
				const typeSymbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
				typeSymbol.outer = scope;
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
		return this.visitQualifiedIdentifier(ctx.qualifiedIdentifier());
	}

	visitFunctionName(ctx: UCParser.FunctionNameContext) {
		const opNode = ctx.operator();
		if (opNode) {
			const identifier: Identifier = {
				name: toName(opNode.text),
				range: rangeFromBounds(opNode.start, opNode.stop)
			};
			return identifier;
		}
		else return ctx.identifier()!.accept(this);
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

		const idNode = ctx.identifier();
		if (idNode) {
			statement.label = idNode.text;
		} else {
			const exprNode = ctx.expression();
			if (exprNode) {
				statement.expression = exprNode.accept(this);
			}
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
			return blockNode.accept(this);
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
		for (var i = 0; i < clauseNodes.length; ++ i) {
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
		if (primaryNode) {
			expression.left = primaryNode.accept<any>(this);
			expression.left!.outer = expression;
		}

		const operatorNode = ctx.assignmentOperator();
		expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.right = exprNode.accept<any>(this);
			expression.right!.outer = expression;
		}
		return expression;
	}

	visitConditionalExpression(ctx: UCParser.ConditionalExpressionContext) {
		const expression = new UCConditionalExpression();
		expression.context = ctx;

		const conditionNode = ctx.unaryExpression();
		if (conditionNode) {
			expression.condition = conditionNode.accept<any>(this);
			expression.condition.outer = expression;
		}

		const leftNode = ctx.expression(0);
		if (leftNode) {
			expression.true = leftNode.accept<any>(this);
			expression.true!.outer = expression;
		}

		const rightNode = ctx.expression(1);
		if (rightNode) {
			expression.false = rightNode.accept<any>(this);
			expression.false!.outer = expression;
		}
		return expression;
	}

	visitBinaryExpression(ctx: UCParser.BinaryExpressionContext) {
		const expression = new UCBinaryExpression();
		expression.context = ctx;

		const leftNode = ctx.unaryExpression();
		if (leftNode) {
			expression.left = leftNode.accept<any>(this);
			expression.left!.outer = expression;
		}

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
		const expression = new UCUnaryExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.expression = primaryNode.accept<any>(this);
			expression.expression.outer = expression;
		}

		const operatorNode = ctx.unaryOperator();
		if (operatorNode) {
			expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
		}
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
		if (idNode) {
			expression.member = createMemberExpressionFromIdentifier(idNode);
			expression.member!.outer = expression;
			return expression;
		}

		const specNode = ctx.classPropertyAccessSpecifier();
		if (specNode) {
			// TODO: recognize this particular kind of a propertyAccessExpression
		}

		throw "PropertyAccess with no member!";
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
			expression.arguments = this.visitExpressionArguments(exprArgumentNodes);
		}
		return expression;
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
			expression.arguments = this.visitExpressionArguments(exprArgumentNodes);
		}
		return expression;
	}

	visitMetaClassExpression(ctx: UCParser.MetaClassExpressionContext) {
		const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
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
			expression.classRef = new UCTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
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

	visitExpressionArguments(ctx: UCParser.ArgumentsContext): IExpression[] | undefined {
		const argumentNodes = ctx.expression();
		if (!argumentNodes) {
			return undefined;
		}

		const expressions: IExpression[] = [];
		for (let arg of argumentNodes) {
			expressions.push(arg.accept(this));
		}
		return expressions;
	}

	// TODO: Implement specialized symbol class.
	visitArrayCountExpression(ctx: UCParser.ArrayCountExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<any>(this);
			expression.expression!.outer = expression;
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

		if (identifiers.length === 1) {
			const type = new UCTypeSymbol(identifiers[0]);
			expression.objectRef = type;
		} else if (identifiers.length > 1) {
			const get = (i: number): UCQualifiedTypeSymbol => {
				const type = new UCTypeSymbol(identifiers[i]);
				const leftType = i-1 > -1 ? get(-- i) : undefined;
				return new UCQualifiedTypeSymbol(type, leftType);
			};
			expression.objectRef = get(identifiers.length-1);
		} else {

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
			expression.memberRef = new UCSymbolReference(createIdentifierFrom(idNode));
		}
		return expression;
	}

	protected defaultResult() {
		return undefined;
	}
}