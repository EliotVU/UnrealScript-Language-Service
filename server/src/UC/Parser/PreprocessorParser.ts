import type { UCLexer } from '../antlr/generated/UCLexer';
import { MacroProvider } from './MacroProvider';
import { UCPreprocessorTokenStream } from './PreprocessorTokenStream';
import { UCTokenStream } from './TokenStream';

export const IntrinsicGlobalMacroProvider: MacroProvider = new MacroProvider("//transient");

// FIXME: STATIC does not play nice when running multi-threaded tests.
export function applyGlobalMacroSymbols(symbols?: {
    [key: string]: string | {
        params?: string[],
        text: string
    };
}) {
    if (symbols) {
        // Apply our custom-macros as global symbols (accessible in any uc file).
        const entries = Object.entries(symbols);
        for (const [macroName, macroDefinition] of entries) {
            if (typeof macroDefinition === 'string') {
                IntrinsicGlobalMacroProvider.setSymbol(macroName.toLowerCase(), { text: macroDefinition });
            } else {
                IntrinsicGlobalMacroProvider.setSymbol(macroName.toLowerCase(), macroDefinition);
            }
        }
    }
}

// FIXME: STATIC does not play nice when running multi-threaded tests.
export function clearGlobalMacroSymbols() {
    IntrinsicGlobalMacroProvider.clearSymbols();
}

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
