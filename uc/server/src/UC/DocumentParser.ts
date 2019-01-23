import * as UCParser from '../antlr/UCGrammarParser';
import { UCGrammarLexer } from '../antlr/UCGrammarLexer';
import { CaseInsensitiveStream } from './CaseInsensitiveStream';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { CommonTokenStream } from 'antlr4ts';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { RuleNode } from 'antlr4ts/tree/RuleNode';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';

import { UCSymbol } from './symbols/UCSymbol';
import { UCClassSymbol, UCType, UCPropertySymbol } from './symbols/symbols';

import { UCDocument, rangeFromTokens, visitExtendsClause, rangeFromToken } from './UCDocument';

export class DocumentParser implements UCGrammarVisitor<UCSymbol>{
	private lexer: UCGrammarLexer;
	private tokenStream: CommonTokenStream;
	private document: UCDocument;

	constructor(text: string) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));
	}

	parse(document: UCDocument) {
		this.document = document;
		this.tokenStream = new CommonTokenStream(this.lexer);

		var parser = new UCParser.UCGrammarParser(this.tokenStream);
		parser.buildParseTree = true;

		parser.addErrorListener(document);
		var programCtx = parser.program();

		try {
			ParseTreeWalker.DEFAULT.walk(document, programCtx);
		} catch (err) {
			console.error('Error walking document', document.uri, err);
		}

		// this.visit(programCtx);
	}

	visit(tree: ParseTree): UCSymbol {
		return tree.accept<UCSymbol>(this);
	}

	visitChildren(node: RuleNode): UCSymbol {
		if (!node) {
			return undefined;
		}
		for (var i = 0; i < node.childCount; ++ i) {
			node.getChild(i).accept(this);
		}
		return undefined;
	}

	visitTerminal(node: TerminalNode): UCSymbol {
		return undefined;
	}

	visitErrorNode(node: ErrorNode): UCSymbol {
		return undefined;
	}

	visitProgram(ctx: UCParser.ProgramContext): UCSymbol {
		var symbol = this.visitChildren(ctx);
		console.log('visitProgram', symbol);
		return symbol;
	}

	visitClassDecl(ctx: UCParser.ClassDeclContext): UCClassSymbol {
		var className = ctx.identifier();
		var classDecl = new UCClassSymbol(
			{ text: className.text, range: rangeFromToken(className.start)},
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		var extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			classDecl.extendsRef = visitExtendsClause(extendsCtx, UCType.Class);
		}

		var withinCtx = ctx.withinClause();
		if (withinCtx) {
			classDecl.withinRef = visitExtendsClause(withinCtx, UCType.Class);
		}
		this.document.class = classDecl;
		return classDecl;
	}

	visitVarDecl(ctx: UCParser.VarDeclContext): UCPropertySymbol {
		return new UCPropertySymbol(undefined, undefined);
	}
}