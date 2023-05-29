import {
    ANTLRErrorListener,
    CommonToken,
    FailedPredicateException,
    InputMismatchException,
    ParserRuleContext,
    RecognitionException,
    Recognizer,
    Token,
} from 'antlr4ts';
import { Position, Range } from 'vscode-languageserver';

import { UCParser } from '../antlr/generated/UCParser';
import { ErrorDiagnostic, IDiagnosticNode } from '../diagnostics/diagnostic';
import { rangeAtStopFromBound } from '../helpers';

export class UCErrorListener implements ANTLRErrorListener<number> {
    public nodes: IDiagnosticNode[] = [];

    syntaxError<T = Token>(recognizer: Recognizer<T, any>,
        offendingSymbol: T | undefined,
        line: number,
        charPositionInLine: number,
        msg: string,
        error: RecognitionException | undefined
    ) {
        if (!error) {
            const expectedTokens = (recognizer as UCParser).getExpectedTokens();
        }
        
        if (error instanceof InputMismatchException) {

            if (error.context && error.expectedTokens && error.expectedTokens.contains(UCParser.SEMICOLON)) {
                msg = 'Missing semicolon.';

                const lastChild = error.context.childCount > 2 ? error.context.getChild(error.context.childCount - 2) : undefined;
                if (lastChild instanceof CommonToken) {
                    const range = rangeAtStopFromBound(lastChild);
                    const node = new ErrorDiagnostic(range, msg);
                    this.nodes.push(node);
                    return;
                } else if (lastChild instanceof ParserRuleContext) {
                    const range = rangeAtStopFromBound(lastChild.stop!);
                    range.start.character += 1;
                    range.end.character += 1;
                    const node = new ErrorDiagnostic(range, msg);
                    this.nodes.push(node);
                    return;
                }
            }
        } else if (error instanceof FailedPredicateException) {
            return;
        }

        const range = Range.create(Position.create(line - 1, charPositionInLine), Position.create(line - 1, charPositionInLine));
        const node = new ErrorDiagnostic(range, msg);
        this.nodes.push(node);
    }
}