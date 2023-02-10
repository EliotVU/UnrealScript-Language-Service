import { ANTLRErrorListener, RecognitionException, Recognizer, Token } from 'antlr4ts';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import { UCLexer } from '../antlr/generated/UCLexer';
import { UCParser } from '../antlr/generated/UCParser';
import { UCInputStream } from './InputStream';
import { UCTokenStream } from './TokenStream';

function resolveExampleFileName(parseTestFileName: string): string {
    return path.join(path.resolve(__dirname, '../../../../grammars/test'), parseTestFileName);
}

function getText(filePath: string): string {
    const text = fs.readFileSync(filePath).toString();
    return text;
}

function parseText(text: string): UCParser {
    const inputStream = UCInputStream.fromString(text);
    const lexer = new UCLexer(inputStream);
    const tokens = new UCTokenStream(lexer);
    // tokens.fill();

    const parser = new UCParser(tokens);
    return parser;
}

function parseExec(parser: UCParser): { errors: string[] } {
    const state: { errors: string[] } = {
        errors: []
    };
    class listener implements ANTLRErrorListener<Token> {
        syntaxError(
            recognizer: Recognizer<Token, any>,
            offendingSymbol: Token | undefined,
            line: number,
            charPositionInLine: number,
            msg: string,
            e: RecognitionException | undefined
        ): void {
            state.errors.push(msg);
        }
    }

    const myl = new listener();
    parser.addErrorListener(myl);
    return state;
}

describe('Grammar', () => {
    it('should have no syntax errors', () => {
        const tests = ['Grammar.uc', 'parser.constDecl.uc', 'parser.defaultPropertiesBlock.uc'];
        for (const testFileName of tests) {
            const text = getText(resolveExampleFileName(testFileName));
            const p = parseText(text);
            const state = parseExec(p);
            p.program();
            console.warn(state.errors.join('\n'));
            expect(state.errors.length === 0, testFileName).to.be.true;
        }
    });
});