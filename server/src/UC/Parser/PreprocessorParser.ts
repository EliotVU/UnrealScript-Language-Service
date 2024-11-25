import path from 'path';
import type { UCLexer } from '../antlr/generated/UCLexer';
import { UCPreprocessorParser } from '../antlr/generated/UCPreprocessorParser';
import type { UCDocument } from '../document';
import { config } from '../indexer';
import { UCGeneration } from '../settings';
import { UCPreprocessorTokenStream } from './PreprocessorTokenStream';
import { UCTokenStream } from './TokenStream';

// FIXME: STATIC does not play nice when running multi-threaded tests.
export function applyGlobalMacroSymbols(symbols?: { [key: string]: string; }) {
    if (symbols) {
        // Apply our custom-macros as global symbols (accessible in any uc file).
        const entries = Object.entries<string>(symbols);
        for (const [key, value] of entries) {
            UCPreprocessorParser.globalSymbols.set(key.toLowerCase(), { text: value });
        }
    }
}

// FIXME: STATIC does not play nice when running multi-threaded tests.
export function clearGlobalMacroSymbols() {
    UCPreprocessorParser.globalSymbols.clear();
}

/**
 * Creates the appropriate TokenStream for the specified generation.
 *
 * @param lexer the lexer to create this token stream from.
 * @param generation the generation required to determine the appropriate TokenStream.
 */
export function createTokenStream(
    document: UCDocument,
    lexer: UCLexer,
    generation: UCGeneration
): UCTokenStream | UCPreprocessorTokenStream {
    const tokenStream = generation === UCGeneration.UC3
        ? new UCPreprocessorTokenStream(lexer)
        : new UCTokenStream(lexer);

    // TODO: Re-factor and separate this concern.
    if (generation === UCGeneration.UC3) {
        const macroParser = (<UCPreprocessorTokenStream>tokenStream).macroParser;

        if (document.fileName.toLowerCase() === 'globals.uci') {
            UCPreprocessorParser.globalSymbols = macroParser.currentSymbols;
            applyGlobalMacroSymbols(config.macroSymbols);
        }

        const classNameMacro = path.basename(document.fileName, path.extname(document.fileName));
        const packageNameMacro = document.classPackage.getName().text;

        macroParser.currentSymbols.set("classname", { text: classNameMacro });
        macroParser.currentSymbols.set("packagename", { text: packageNameMacro });
        macroParser.filePath = document.filePath;
    }

    return tokenStream;
}
