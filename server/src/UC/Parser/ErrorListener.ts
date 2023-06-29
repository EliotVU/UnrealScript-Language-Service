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

    private reportError(message: string, line: number, column: number) {
        const range = Range.create(Position.create(line - 1, line), Position.create(line - 1, column));
        const node = new ErrorDiagnostic(range, message);
        this.nodes.push(node);
    }

    syntaxError<T = Token>(recognizer: Recognizer<T, any>,
        offendingSymbol: T | undefined,
        line: number,
        column: number,
        message: string,
        error: RecognitionException | undefined
    ) {
        const parser = (recognizer as UCParser);
        if (!error) {
            const expectedTokens = parser.getExpectedTokens();
        }

        if (offendingSymbol) {
            const { ruleContext } = parser;
            if (ruleContext.ruleIndex === UCParser.RULE_identifier) {
                return this.reportError('Identifier expected.', line, column);
            }

            if (error instanceof InputMismatchException) {
                if (error.context && error.expectedTokens && error.expectedTokens.contains(UCParser.SEMICOLON)) {
                    message = `';' expected.`;

                    const lastChild = error.context.childCount > 2 ? error.context.getChild(error.context.childCount - 2) : undefined;
                    if (lastChild instanceof CommonToken) {
                        const range = rangeAtStopFromBound(lastChild);
                        const node = new ErrorDiagnostic(range, message);
                        this.nodes.push(node);
                        return;
                    } else if (lastChild instanceof ParserRuleContext) {
                        const range = rangeAtStopFromBound(lastChild.stop!);
                        range.start.character += 1;
                        range.end.character += 1;
                        const node = new ErrorDiagnostic(range, message);
                        this.nodes.push(node);
                        return;
                    }
                }
            } else if (error instanceof FailedPredicateException) {
                return;
            }
        }

        return this.reportError(message, line, column);
    }
}
