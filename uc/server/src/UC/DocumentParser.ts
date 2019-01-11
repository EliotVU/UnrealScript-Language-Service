import { CommonTokenStream } from 'antlr4ts';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';
import { UCGrammarLexer } from '../antlr/UCGrammarLexer';
import { CaseInsensitiveStream } from './CaseInsensitiveStream';
import { UCDocument } from './UCDocument';
import * as UCParser from '../antlr/UCGrammarParser';

export class DocumentParser {
	private lexer: UCGrammarLexer;
	private parser: UCParser.UCGrammarParser;
	private tokenStream: CommonTokenStream;

	constructor(text: string) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));
		this.tokenStream = new CommonTokenStream(this.lexer);
		this.parser = new UCParser.UCGrammarParser(this.tokenStream);
		this.parser.buildParseTree = true;
	}

	parse(document: UCDocument) {
		this.parser.addErrorListener(document);
		let tree = this.parser.program();
		ParseTreeWalker.DEFAULT.walk(document, tree);
	}
}
