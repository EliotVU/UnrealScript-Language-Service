import { DefaultErrorStrategy, Parser, RecognitionException, ParserRuleContext } from 'antlr4ts';

import { UCGrammarParser } from '../../antlr/UCGrammarParser';

export class UCMissingSemicolonException extends Error {
	constructor(private context: ParserRuleContext) {
		super();
	}
}

export class UCErrorStrategy extends DefaultErrorStrategy {
	reportError(recognizer: Parser, e: RecognitionException) {
		if (e.expectedTokens
			&& e.expectedTokens.contains(UCGrammarParser.SEMICOLON)
			){
			const token = this.constructToken(
				recognizer.inputStream.tokenSource,
				UCGrammarParser.SEMICOLON, ';',
				recognizer.currentToken
			);

			recognizer.context.addChild(recognizer.createTerminalNode(recognizer.context, token));

			// this.reportMatch(recognizer);

			// const error = new UCMissingSemicolonException(recognizer.context);
			this.notifyErrorListeners(recognizer, "Missing semicolon!", e);
			// return;
		}

		super.reportError(recognizer, e);
	}
}

export const ERROR_STRATEGY = new UCErrorStrategy();