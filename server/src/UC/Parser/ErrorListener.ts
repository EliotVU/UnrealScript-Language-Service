import {
    ANTLRErrorListener,
    ATNConfigSet,
    ATNSimulator,
    BitSet,
    CommonToken,
    DFA,
    FailedPredicateException,
    InputMismatchException,
    Parser,
    ParserRuleContext,
    RecognitionException,
    Recognizer,
    Token,
} from 'antlr4ng';
import { Position, Range } from 'vscode-languageserver';

import { UCParser } from '../antlr/generated/UCParser.js';
import { ErrorDiagnostic, IDiagnosticNode } from '../diagnostics/diagnostic.js';
import { rangeAtStopFromBound, rangeFromBound } from '../helpers.js';

export class UCErrorListener implements ANTLRErrorListener {
    reportAmbiguity(
        recognizer: Parser,
        dfa: DFA,
        startIndex: number,
        stopIndex: number,
        exact: boolean,
        ambigAlts: BitSet | undefined,
        configs: ATNConfigSet
    ): void {
        // throw new Error('Method not implemented.');
    }
    reportAttemptingFullContext(
        recognizer: Parser,
        dfa: DFA,
        startIndex: number,
        stopIndex: number,
        conflictingAlts: BitSet | undefined,
        configs: ATNConfigSet
    ): void {
        // throw new Error('Method not implemented.');
    }
    reportContextSensitivity(
        recognizer: Parser,
        dfa: DFA,
        startIndex: number,
        stopIndex: number,
        prediction: number,
        configs: ATNConfigSet
    ): void {
        // throw new Error('Method not implemented.');
    }
    public nodes: IDiagnosticNode[] = [];

    private reportError(message: string, line: number, column: number) {
        const range = Range.create(
            Position.create(line - 1, column + 1),
            Position.create(line - 1, column + 1)
        );
        const node = new ErrorDiagnostic(range, message);
        this.nodes.push(node);
    }

    private reportErrorRange(message: string, range: Range) {
        const node = new ErrorDiagnostic(range, message);
        this.nodes.push(node);
    }

    syntaxError<S extends Token, T extends ATNSimulator>(
        recognizer: Recognizer<T>,
        offendingSymbol: S | null,
        line: number,
        column: number,
        message: string,
        error: RecognitionException | null
    ): void {
        const parser = recognizer as unknown as UCParser;
        if (!error) {
            const expectedTokens = parser.getExpectedTokens();

            if (offendingSymbol) {
                return this.reportErrorRange(
                    `Unexpected '${offendingSymbol.text}'.`,
                    rangeFromBound(offendingSymbol)
                );
            }
        }

        if (offendingSymbol) {
            const { context } = parser;

            if (context?.ruleIndex === UCParser.RULE_identifier) {
                return this.reportError("Identifier expected.", line, column);
            }

            if (error instanceof InputMismatchException) {
                const expectedTokens = error.getExpectedTokens();
                if (
                    error.ctx &&
                    expectedTokens &&
                    expectedTokens.contains(UCParser.SEMICOLON)
                ) {
                    message = `';' expected.`;

                    const lastChild =
                        error.ctx.getChildCount() > 2
                            ? error.ctx.getChild(error.ctx.getChildCount() - 2)
                            : null;
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
