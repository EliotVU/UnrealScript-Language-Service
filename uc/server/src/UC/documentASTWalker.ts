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

export class DocumentASTWalker implements UCGrammarVisitor<ISymbol | undefined>, ANTLRErrorListener<Token> {
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

	visitClassType(classTypeNode: UCParser.ClassTypeContext): UCTypeSymbol | undefined {
		const typeNode = classTypeNode.identifier();
		if (!typeNode) {
			// e.g. "var class Class;" with no class delimiter.
			return undefined;
		}

		return new UCTypeSymbol(typeNode.text, rangeFromBounds(typeNode.start, typeNode.stop), undefined, UCTypeKind.Class);
	}

	visitTypeDecl(typeDeclNode: UCParser.TypeDeclContext): UCTypeSymbol {
		let typeIdText: string;
		let typeIdRange: Range;
		let innerTypeSymbol: UCTypeSymbol | undefined;

		const typeNode = typeDeclNode.predefinedType() || typeDeclNode.qualifiedIdentifier();
		if (typeNode) {
			typeIdText = typeNode.text;
			typeIdRange = rangeFromBounds(typeNode.start, typeNode.stop);
		} else {
			const classTypeNode = typeDeclNode.classType();
			if (classTypeNode) {
				innerTypeSymbol = this.visitClassType(classTypeNode);
				typeIdText = 'Class';
				typeIdRange = rangeFromBound(classTypeNode.start);
			} else if (typeDeclNode instanceof UCParser.TypeDeclContext) {
				const arrayTypeNode = typeDeclNode.arrayType();
				if (arrayTypeNode) {
					innerTypeSymbol = this.visitInlinedDeclTypes(arrayTypeNode.inlinedDeclTypes());
					typeIdText = 'Array';
					typeIdRange = rangeFromBound(arrayTypeNode.start);
				}
			}
		}

		const typeSymbol = new UCTypeSymbol(typeIdText!, typeIdRange!, rangeFromBounds(typeDeclNode.start, typeDeclNode.stop));
		typeSymbol.outer = this.scope<UCStructSymbol>();
		typeSymbol.baseType = innerTypeSymbol;
		if (innerTypeSymbol) {
			innerTypeSymbol.outer = typeSymbol;
		}
		return typeSymbol;
	}

	visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext): UCTypeSymbol | undefined {
		const structDeclNode = inlinedTypeCtx.structDecl();
		if (structDeclNode) {
			structDeclNode.accept<any>(this);
			const structIdNode = structDeclNode.identifier();
			return new UCTypeSymbol(structIdNode.text, rangeFromBounds(structIdNode.start, structIdNode.stop), undefined, UCTypeKind.Struct);
		}

		const enumDeclNode = inlinedTypeCtx.enumDecl();
		if (enumDeclNode) {
			enumDeclNode.accept<any>(this);
			const enumIdNode = enumDeclNode.identifier();
			return new UCTypeSymbol(enumIdNode.text, rangeFromBounds(enumIdNode.start, enumIdNode.stop), undefined, UCTypeKind.Enum);
		}

		const typeDeclNode = inlinedTypeCtx.typeDecl();
		if (typeDeclNode) {
			return this.visitTypeDecl(typeDeclNode);
		}
		return undefined;
	}

	visitExtendsClause(ctx: UCParser.ExtendsClauseContext) {
		const idNode = ctx.qualifiedIdentifier();
		const symbol = new UCTypeSymbol(idNode.text, rangeFromBounds(idNode.start, idNode.stop!), undefined, UCTypeKind.Class);
		return symbol;
	}

	visitWithinClause(ctx: UCParser.WithinClauseContext) {
		const idNode = ctx.qualifiedIdentifier();
		const symbol = new UCTypeSymbol(idNode.text, rangeFromBounds(idNode.start, idNode.stop!), undefined, UCTypeKind.Class);
		return symbol;
	}

	visitClassDecl(ctx: UCParser.ClassDeclContext) {
		const classIdNode = ctx.identifier();
		const symbol = new UCDocumentClassSymbol(classIdNode.text, rangeFromBound(classIdNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
							const typeSymbol = new UCTypeSymbol(valueNode.text, rangeFromBounds(valueNode.start, valueNode.stop), undefined, UCTypeKind.Class);
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
							const typeSymbol = new UCTypeSymbol(valueNode.text, rangeFromBounds(valueNode.start, valueNode.stop), undefined, UCTypeKind.Class);
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
		const idNode = ctx.identifier();
		const symbol = new UCConstSymbol(idNode.text, rangeFromBound(idNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
		const idNode = ctx.identifier();
		const symbol = new UCEnumSymbol(idNode.text, rangeFromBound(idNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
		const idNode = ctx.identifier();
		const range = rangeFromBound(ctx.start);
		const symbol = new UCEnumMemberSymbol(idNode.text, range, range);
		this.declare(symbol);
		setEnumMember(symbol);
		return symbol;
	}

	visitStructDecl(ctx: UCParser.StructDeclContext) {
		const idNode = ctx.identifier();
		const symbol = new UCScriptStructSymbol(idNode.text, rangeFromBound(idNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
		const symbol = new UCReplicationBlock(nameNode.text, rangeFromBound(nameNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
				const identifier = idNode.text;
				const symbolRef = new UCSymbolReference(identifier, rangeFromBound(idNode.start));
				symbolRef.outer = this.document.class;
				symbol.symbolRefs.set(identifier.toLowerCase(), symbolRef);
			}
		}
		symbol.block = block;
		return symbol;
	}

	visitFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const idNode = ctx.functionName();
		const symbol = new UCMethodSymbol(
			// We need start and stop for functions with special symbols (which are made of multiple tokens)
			idNode!.text, rangeFromBounds(idNode!.start, idNode!.stop),
			rangeFromBounds(ctx.start, ctx.stop)
		);
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
		const idNode = ctx.identifier();

		const scope = this.scope();
		const type = scope instanceof UCMethodSymbol ? UCLocalSymbol : UCPropertySymbol;
		const symbol = new type(
			idNode.text, rangeFromBound(idNode.start),
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
		const stateIdNode = ctx.identifier();

		const symbol = new UCStateSymbol(stateIdNode.text, rangeFromBound(stateIdNode.start), rangeFromBounds(ctx.start, ctx.stop));
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
			const ref = new UCSymbolReference(idNode.text, rangeFromBounds(idNode.start, idNode.stop));
			scope.ignoreRefs.push(ref);
		}
		return undefined;
	}

	visitDefaultStatement(ctx: UCParser.DefaultStatementContext) {
		return this.visitChildren(ctx);
	}

	visitStructDefaultPropertiesBlock(ctx: UCParser.StructDefaultPropertiesBlockContext) {
		const nameNode = ctx.kwSTRUCTDEFAULTPROPERTIES();
		const symbol = new UCDefaultPropertiesBlock(
			nameNode.text, rangeFromBound(nameNode.start),
			rangeFromBounds(ctx.start, ctx.stop)
		);
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
		const symbol = new UCDefaultPropertiesBlock(
			nameNode.text, rangeFromBound(nameNode.start),
			rangeFromBounds(ctx.start, ctx.stop)
		);
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
		const symbol = new UCObjectSymbol(
			'', rangeFromBound(ctx.start),
			rangeFromBounds(ctx.start, ctx.stop)
		);
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
		const idNode = ctx.defaultId();
		const scope = this.scope<UCObjectSymbol>();

		const symbolRef = new UCSymbolReference(idNode.text, rangeFromBound(ctx.start));
		symbolRef.outer = scope;

		const propNameLC = idNode.text.toLowerCase();
		switch (propNameLC) {
			case 'name': {
				// TODO: change name
			}

			case 'class': {
				const typeSymbol = new UCTypeSymbol(
					symbolRef.getName(), rangeFromBounds(idNode.start, idNode.stop), undefined,
					UCTypeKind.Class
				);
				typeSymbol.outer = scope;
				scope.extendsType = typeSymbol;
			}
		}
		scope.symbolRefs.set(propNameLC, symbolRef);

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
		const symbol = new UCObjectSymbol(
			// Use the same name as the assigned var's name.
			'', rangeFromBound(ctx.start),
			rangeFromBounds(ctx.start, ctx.stop)
		);
		this.push(symbol);
		// TODO: members
		this.pop();
		return symbol;
	}
}