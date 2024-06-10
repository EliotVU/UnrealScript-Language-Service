import { DefaultErrorStrategy, Parser, RecognitionException, Token } from 'antlr4ng';

import { UCParser } from '../antlr/generated/UCParser.js';

export class UCErrorStrategy extends DefaultErrorStrategy {
    override singleTokenDeletion(recognizer: Parser): Token | null {
        return null;
    }

    override reportError(recognizer: Parser, e: RecognitionException) {
        if (!recognizer.context) {
            return super.reportError(recognizer, e);
        }

        const expectedTokens = e.getExpectedTokens();
        if (expectedTokens === null) {
            return super.reportError(recognizer, e);
        }

        if (expectedTokens.contains(UCParser.SEMICOLON)) {
            const ctx = recognizer.getCurrentToken();
            const token = recognizer.getTokenFactory().create(
                [recognizer.inputStream.tokenSource, null],
                UCParser.SEMICOLON, ';',
                Token.DEFAULT_CHANNEL,
                ctx.start,
                ctx.start,
                ctx.line,
                ctx.column
            );

            recognizer.context.addTokenNode(token);
        } else if (expectedTokens.contains(UCParser.ASSIGNMENT)) {
            const ctx = recognizer.getCurrentToken();
            const token = recognizer.getTokenFactory().create(
                [recognizer.inputStream.tokenSource, null],
                UCParser.SEMICOLON, '=',
                Token.DEFAULT_CHANNEL,
                ctx.start,
                ctx.start,
                ctx.line,
                ctx.column
            );

            recognizer.context.addTokenNode(token);
        }
        // else if (expectedTokens.contains(UCParser.OPEN_PARENS)) {
        //     const openToken = this.constructToken(
        //         recognizer.inputStream.getTokenSource(),
        //         UCParser.OPEN_PARENS, '(',
        //         recognizer.getCurrentToken()
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, openToken));

        //     const closeToken = this.constructToken(
        //         recognizer.inputStream.getTokenSource(),
        //         UCParser.CLOSE_PARENS, ')',
        //         recognizer.getCurrentToken()
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, closeToken));
        // } else if (expectedTokens.contains(UCParser.CLOSE_PARENS)) {
        //     const closeToken = this.constructToken(
        //         recognizer.inputStream.getTokenSource(),
        //         UCParser.CLOSE_PARENS, ')',
        //         recognizer.getCurrentToken()
        //     );
        //     recognizer.context.addErrorNode(recognizer.createErrorNode(recognizer.context, closeToken));

        super.reportError(recognizer, e);
    }
}

export const ERROR_STRATEGY = new UCErrorStrategy();
