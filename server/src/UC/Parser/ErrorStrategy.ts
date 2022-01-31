import { DefaultErrorStrategy, Parser, RecognitionException } from 'antlr4ts';

import { UCParser } from '../antlr/generated/UCParser';

export class UCErrorStrategy extends DefaultErrorStrategy {
    reportError(recognizer: Parser, e: RecognitionException) {
        if (typeof e.expectedTokens === 'undefined') {
            super.reportError(recognizer, e);
            return;
        }

        if (e.expectedTokens.contains(UCParser.SEMICOLON)) {
            const token = this.constructToken(
                recognizer.inputStream.tokenSource,
                UCParser.SEMICOLON, ';',
                recognizer.currentToken,
            );

            const node = recognizer.createTerminalNode(recognizer.context, token);
            recognizer.context.addChild(node);
        } else if (e.expectedTokens.contains(UCParser.ASSIGNMENT)) {
            const token = this.constructToken(
                recognizer.inputStream.tokenSource,
                UCParser.ASSIGNMENT, '=',
                recognizer.currentToken,
            );

            const node = recognizer.createTerminalNode(recognizer.context, token);
            recognizer.context.addChild(node);
        }
        // else if (e.expectedTokens.contains(UCParser.OPEN_PARENS)) {
        //     const openToken = this.constructToken(
        //         recognizer.inputStream.tokenSource,
        //         UCParser.OPEN_PARENS, '(',
        //         recognizer.currentToken
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, openToken));

        //     const closeToken = this.constructToken(
        //         recognizer.inputStream.tokenSource,
        //         UCParser.CLOSE_PARENS, ')',
        //         recognizer.currentToken
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, closeToken));
        // } else if (e.expectedTokens.contains(UCParser.CLOSE_PARENS)) {
        //     const closeToken = this.constructToken(
        //         recognizer.inputStream.tokenSource,
        //         UCParser.CLOSE_PARENS, ')',
        //         recognizer.currentToken
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, closeToken));

        super.reportError(recognizer, e);
    }
}

export const ERROR_STRATEGY = new UCErrorStrategy();