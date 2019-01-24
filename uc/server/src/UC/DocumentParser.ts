import { CommonTokenStream } from 'antlr4ts';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

import * as UCParser from '../antlr/UCGrammarParser';
import { UCGrammarLexer } from '../antlr/UCGrammarLexer';

import { CaseInsensitiveStream } from './CaseInsensitiveStream';
import { UCDocumentListener } from './DocumentListener';

export class DocumentParser {
	private lexer: UCGrammarLexer;
	private tokenStream: CommonTokenStream;

	constructor(text: string) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));
	}

	parse(document: UCDocumentListener) {
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
	}
}