import type { UCLexer } from '../antlr/generated/UCLexer';
import { MacroProvider } from './MacroProvider';
import { UCPreprocessorTokenStream } from './PreprocessorTokenStream';
import { UCTokenStream } from './TokenStream';

export const IntrinsicGlobalMacroProvider: MacroProvider = new MacroProvider("//transient");

/**
 * Creates the appropriate TokenStream.
 *
 * @param lexer the lexer to create this token stream from.
 */
export function createTokenStream(
    lexer: UCLexer,
    macroProvider: MacroProvider | undefined,
): UCTokenStream | UCPreprocessorTokenStream {
    const tokenStream = typeof macroProvider === 'undefined'
        ? new UCTokenStream(lexer)
        : new UCPreprocessorTokenStream(lexer, macroProvider);

    return tokenStream;
}
