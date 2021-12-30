import { ANTLRErrorListener, RecognitionException, Recognizer, Token } from 'antlr4ts';
import { Position, Range } from 'vscode-languageserver';

import { ErrorDiagnostic, IDiagnosticNode } from '../diagnostics/diagnostic';

export class UCErrorListener implements ANTLRErrorListener<number> {
    public nodes: IDiagnosticNode[] = [];

    syntaxError<T = Token>(_recognizer: Recognizer<T, any>,
        offendingSymbol: T | undefined,
        _line: number,
        _charPositionInLine: number,
        msg: string,
        error: RecognitionException | undefined
    ) {
        const range = Range.create(Position.create(_line - 1, _charPositionInLine), Position.create(_line - 1, _charPositionInLine));
        const node = new ErrorDiagnostic(range, msg);
        this.nodes.push(node);
    }
}