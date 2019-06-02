import { Range } from 'vscode-languageserver-types';

import { ANTLRErrorListener, RecognitionException, Recognizer, Token, ParserRuleContext } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

import * as UCParser from '../antlr/UCGrammarParser';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds, rangeFromBound } from './helpers';

import { ISymbolContainer } from './Symbols/ISymbolContainer';
import {
	ISymbol, UCConstSymbol, UCDefaultPropertiesBlock,
	UCEnumMemberSymbol, UCEnumSymbol, UCMethodSymbol,
	UCLocalSymbol, UCObjectSymbol,
	UCPropertySymbol, UCScriptStructSymbol, UCStateSymbol,
	UCStructSymbol, UCSymbol, UCSymbolReference,
	UCTypeSymbol,
	UCDocumentClassSymbol, UCReplicationBlock
} from './Symbols';
import { UCTypeKind } from './Symbols/TypeKind';

import { SyntaxErrorNode } from './diagnostics/diagnostics';

import { UCBlock, IStatement } from './statements';
import { setEnumMember } from './indexer';
import { StatementVisitor } from './statementWalker';
import { UCDocument } from './document';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { RuleNode } from 'antlr4ts/tree/RuleNode';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { Identifier } from './Symbols/ISymbol';

export function createIdentifierFrom(ctx: ParserRuleContext) {
	const identifier: Identifier = {
		name: ctx.text,
		range: rangeFromBound(ctx.start)
	};

	return identifier;
}

export class DocumentASTWalker implements UCGrammarVisitor<ISymbol | undefined | any>, ANTLRErrorListener<Token> {
	private scopes: ISymbolContainer<ISymbol>[] = [];

	constructor(private document: UCDocument) {
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

	visit(tree: ParseTree) {
		return undefined!;
	}

	visitChildren(node: RuleNode) {
		for (let i = 0; i < node.childCount; ++ i) {
			node.getChild(i).accept<any>(this);
		}
		return undefined;
	}

	visitTerminal(node: TerminalNode) {
		return undefined!;
	}

	visitErrorNode(errNode: ErrorNode) {
		const node = new SyntaxErrorNode(rangeFromBound(errNode.symbol), '(ANTLR Node Error) ' + errNode.text);
		this.document.nodes.push(node);
		return undefined!;
	}

	visitProgram(ctx: UCParser.ProgramContext) {
		ParseTreeWalker.DEFAULT.walk(this, ctx);
		if (!ctx.children) {
			return undefined;
		}

		for (let child of ctx.children) {
			const symbol = child.accept<any>(this);
			// if (symbol instanceof UCSymbol) {
			// 	this.declare(symbol);
			// }
		}
		return undefined;
	}

	visitTypeDecl(typeDeclNode: UCParser.TypeDeclContext): UCTypeSymbol {
		const typeNode = typeDeclNode.predefinedType() || typeDeclNode.qualifiedIdentifier();
		if (typeNode) {
			const identifier: Identifier = {
				name: typeNode.text,
				range: rangeFromBounds(typeNode.start, typeNode.stop)
			};
			const symbol = new UCTypeSymbol(identifier, rangeFromBounds(typeNode.start, typeNode.stop));
			symbol.outer = this.scope<UCStructSymbol>(); // FIXME: necessary?
			return symbol;
		}

		const classTypeNode = typeDeclNode.classType();
		if (classTypeNode) {
			const identifier: Identifier = {
				name: 'Class',
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
				name: 'Array',
				range: rangeFromBound(arrayTypeNode.start)
			};
			const symbol = new UCTypeSymbol(identifier, rangeFromBounds(arrayTypeNode.start, arrayTypeNode.stop));
			symbol.outer = this.scope<UCStructSymbol>();

			const baseTypeNode = arrayTypeNode.inlinedDeclTypes();
			if (baseTypeNode && (symbol.baseType = this.visitInlinedDeclTypes(baseTypeNode))) {
				symbol.baseType.outer = symbol;
			}
		}

		const identifier: Identifier = {
			name: typeDeclNode.text,
			range: rangeFromBound(typeDeclNode.start)
		};
		const symbol = new UCTypeSymbol(identifier, rangeFromBounds(typeDeclNode.start, typeDeclNode.stop));
		symbol.outer = this.scope<UCStructSymbol>();
		return symbol;
	}

	visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext): UCTypeSymbol | undefined {
		const structDeclNode = inlinedTypeCtx.structDecl();
		if (structDeclNode) {
			structDeclNode.accept<any>(this);
			const structIdentifier = structDeclNode.identifier().accept(this);
			return new UCTypeSymbol(structIdentifier, undefined, UCTypeKind.Struct);
		}

		const enumDeclNode = inlinedTypeCtx.enumDecl();
		if (enumDeclNode) {
			enumDeclNode.accept<any>(this);
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
		const identifier = ctx.qualifiedIdentifier().accept(this);
		const symbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
		return symbol;
	}

	visitWithinClause(ctx: UCParser.WithinClauseContext) {
		const identifier = ctx.qualifiedIdentifier().accept(this);
		const symbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
		return symbol;
	}

	visitClassDecl(ctx: UCParser.ClassDeclContext) {
		const identifier: Identifier = ctx.identifier().accept(this);
		const symbol = new UCDocumentClassSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;
		this.document.class = symbol; // Important!, must be assigned before further parsing.

		const extendsNode = ctx.extendsClause();
		if (extendsNode) {
			symbol.extendsType = extendsNode.accept<any>(this);
			symbol.extendsType!.outer = symbol;
		}

		const withinNode = ctx.withinClause();
		if (withinNode) {
			symbol.withinType = withinNode.accept<any>(this);
			symbol.withinType!.outer = symbol;
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
								name: valueNode.text,
								range: rangeFromBounds(valueNode.start, valueNode.stop)
							};
							const typeSymbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
							symbol.dependsOnTypes.push(typeSymbol);
						}
					}
				}
				case 'implements': {
					if (modifierArgumentNodes) {
						if (!symbol.implementsTypes) {
							symbol.implementsTypes = [];
						}
						for (let valueNode of modifierArgumentNodes.modifierValue()) {
							const identifier: Identifier = {
								name: valueNode.text,
								range: rangeFromBounds(valueNode.start, valueNode.stop)
							};
							const typeSymbol = new UCTypeSymbol(identifier, undefined, UCTypeKind.Class);
							symbol.implementsTypes.push(typeSymbol);
						}
					}
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
			const extendsType = this.visitExtendsClause(extendsNode);
			extendsType.setTypeKind(UCTypeKind.Struct);
			symbol.extendsType = extendsType;
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
		const nameNode = ctx.kwREPLICATION();
		const identifier: Identifier = {
			name: 'replication',
			range: rangeFromBound(nameNode.start)
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
			const statement = statementNodes[i].accept<IStatement>(StatementVisitor);
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
		const symbol = varNode.accept<any>(this);
		symbol.type = typeSymbol;
		this.declare(symbol);
		return symbol;
	}

	visitLocalDecl(ctx: UCParser.LocalDeclContext) {
		const propTypeNode = ctx.typeDecl();
		const typeSymbol = this.visitTypeDecl(propTypeNode);

		const varNodes = ctx.variable();
		for (const varNode of varNodes) {
			const symbol = varNode.accept<any>(this);
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
			const symbol = varNode.accept<any>(this);
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
			const statement = nodes[i].accept(StatementVisitor);
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
			const extendsType = this.visitExtendsClause(extendsNode);
			extendsType.setTypeKind(UCTypeKind.State);
			symbol.extendsType = extendsType;
		}

		this.declare(symbol);

		this.push(symbol);
		const members = ctx.stateMember();
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

	visitIgnoresList(ctx: UCParser.IgnoresListContext) {
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
		const nameNode = ctx.kwSTRUCTDEFAULTPROPERTIES();
		const identifier: Identifier = {
			name: 'structdefaultproperties',
			range: rangeFromBound(nameNode.start)
		};
		const symbol = new UCDefaultPropertiesBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept<any>(this);
		}
		this.pop();
		return symbol;
	}

	visitDefaultPropertiesBlock(ctx: UCParser.DefaultPropertiesBlockContext) {
		const nameNode = ctx.kwDEFAULTPROPERTIES();
		const identifier: Identifier = {
			name: 'defaultproperties',
			range: rangeFromBound(nameNode.start)
		};

		const symbol = new UCDefaultPropertiesBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept<any>(this);
		}
		this.pop();
		return symbol;
	}

	visitObjectDecl(ctx: UCParser.ObjectDeclContext) {
		const identifier: Identifier = {
			name: '',
			range: rangeFromBound(ctx.start)
		};
		const symbol = new UCObjectSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
		const members = ctx.defaultStatement();
		if (members) for (const member of members) {
			member.accept<any>(this);
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
			case 'name': {
				// TODO: change name
			}

			case 'class': {
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
			name: '',
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
				name: opNode.text,
				range: rangeFromBounds(opNode.start, opNode.stop)
			};
			return identifier;
		}
		else return ctx.identifier()!.accept(this);
	}

	visitIdentifier(ctx: UCParser.IdentifierContext) {
		const identifier: Identifier = {
			name: ctx.text,
			range: rangeFromBound(ctx.start)
		};

		return identifier;
	}

	visitQualifiedIdentifier(ctx: UCParser.QualifiedIdentifierContext) {
		const identifier: Identifier = {
			name: ctx.text,
			range: rangeFromBounds(ctx.start, ctx.stop)
		};

		return identifier;
	}
}