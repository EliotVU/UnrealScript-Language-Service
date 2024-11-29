import { Token } from 'antlr4ts';
import { UCLexer } from '../antlr/generated/UCLexer';
import { ExternalTokenFactory, type ExternalToken } from './ExternalTokenFactory';
import { UCInputStream } from './InputStream';

const TRANSIENT_RAW_INPUT = UCInputStream.fromString('');
const TRANSIENT_RAW_LEXER = new UCLexer(TRANSIENT_RAW_INPUT);
TRANSIENT_RAW_LEXER.tokenFactory = new ExternalTokenFactory();

export function textToTokens(text: string, lexer: UCLexer = TRANSIENT_RAW_LEXER, source?: string): ExternalToken[] {
    const inputStream = UCInputStream.fromString(text);
    lexer.inputStream = inputStream;

    const tokens = lexer.getAllTokens() as ExternalToken[];
    if (typeof source !== 'undefined') {
        for (let i = 0; i < tokens.length; ++i) {
            tokens[i].externalSource = source;
        }
    }

    // Pop the End of File token
    if (lexer._hitEOF && tokens.at(-1)?.type === Token.EOF) {
        lexer._hitEOF = false;
        tokens.pop();
    }

    // release
    lexer.inputStream = TRANSIENT_RAW_INPUT;

    return tokens;
}
