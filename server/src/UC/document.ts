import { CommonTokenStream } from 'antlr4ts';
import { PredictionMode } from 'antlr4ts/atn/PredictionMode';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { DocumentUri } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { UCErrorListener } from './Parser/ErrorListener';
import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { UCInputStream } from './Parser/InputStream';
import { UCTokenStream } from './Parser/TokenStream';
import {
    ISymbol,
    SymbolReference,
    SymbolsTable,
    UCClassSymbol,
    UCObjectSymbol,
    UCPackage,
    UCStructSymbol,
    UCSymbolKind,
    isStruct,
    removeHashedSymbol,
} from './Symbols';
import { UCLexer } from './antlr/generated/UCLexer';
import { Licensee, ProgramContext, UCParser } from './antlr/generated/UCParser';
import { UCPreprocessorParser } from './antlr/generated/UCPreprocessorParser';
import { IDiagnosticNode } from './diagnostics/diagnostic';
import { DocumentASTWalker } from './documentASTWalker';
import { IndexedReferencesMap, applyMacroSymbols, config } from './indexer';
import { Name, NameHash, toName } from './name';
import { UCGeneration } from './settings';
import { SymbolWalker } from './symbolWalker';

function removeChildren(scope: UCStructSymbol) {
    for (let child = scope.children; child; child = child.next) {
        if (isStruct(child)) {
            removeChildren(child);
        }
        if (child.kind === UCSymbolKind.ScriptStruct
            || child.kind === UCSymbolKind.Enum
            || child.kind === UCSymbolKind.Archetype) {
            removeHashedSymbol(child);
        }
    }
}

export type DocumentParseData = {
    context?: ProgramContext;
    parser: UCParser;
};

export class UCDocument {
    /** File name and extension. */
    public readonly fileName: string;

    /** Case-insensitive document name with the extension stripped off. */
    public readonly name: Name;

    /** URI to the document file. */
    public readonly uri: DocumentUri;

    /** The current indexed TextDocument's version as reported by the client. */
    public indexedVersion = 0;

    // TODO: Displace this with a DiagnosticCollection visitor.
    public nodes: IDiagnosticNode[] = [];

    /** The class or interface header symbol */
    public class?: UCClassSymbol = undefined;
    public hasBeenBuilt = false;
    public hasBeenIndexed = false;

    private readonly indexReferencesMade = new Map<NameHash, Set<SymbolReference>>();

    // List of symbols, including macro declarations.
    private readonly scope = new SymbolsTable<UCObjectSymbol>();

    constructor(readonly filePath: string, public readonly classPackage: UCPackage) {
        this.fileName = path.basename(filePath);
        this.name = toName(path.basename(this.fileName, path.extname(filePath)));
        this.uri = URI.file(filePath).toString();
    }

    public enumerateSymbols() {
        return this.scope.enumerate();
    }

    public addSymbol(symbol: UCObjectSymbol): void {
        this.scope.addSymbol(symbol);
    }

    public hasSymbols(): boolean {
        return this.scope.count() > 0;
    }

    public getSymbol<T extends UCObjectSymbol>(name: Name): T {
        return this.scope.getSymbol(name.hash) as T;
    }

    public parse(text: string): DocumentParseData {
        console.log(`parsing document "${this.fileName}"`);

        const inputStream = UCInputStream.fromString(text);
        const lexer = new UCLexer(inputStream);
        lexer.removeErrorListeners();
        const tokens = new UCTokenStream(lexer);

        if (config.generation === UCGeneration.UC3) {
            const startPreprocressing = performance.now();
            const macroParser = createPreprocessor(this, lexer);
            lexer.reset();
            if (macroParser) {
                try {
                    const macroTree = preprocessDocument(this, macroParser);
                    if (macroTree) {
                        tokens.initMacroTree(macroTree);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    console.info(`${this.fileName}: preprocessing time ${performance.now() - startPreprocressing}`);
                }
            }
        }

        // tokens.fill();

        let context: ProgramContext | undefined;
        const parser = new UCParser(tokens);
        parser.generation = config.generation === '3'
            ? 3 : config.generation === '2'
                ? 2 : config.generation === '1'
                    ? 1 : 3;
        parser.licensee = config.licensee as unknown as Licensee;
        try {
            parser.interpreter.setPredictionMode(PredictionMode.SLL);
            parser.errorHandler = ERROR_STRATEGY;
            parser.removeErrorListeners();
            context = parser.program();
        } catch (err) {
            console.debug('PredictionMode SLL has failed, rolling back to LL.');
            try {
                parser.reset();
                parser.interpreter.setPredictionMode(PredictionMode.LL);
                parser.errorHandler = ERROR_STRATEGY;
                parser.removeErrorListeners();
                context = parser.program();
            } catch (err) {
                console.error(
                    `An error was thrown while parsing document: "${this.uri}"`,
                    err
                );
            }
        }
        tokens.release(tokens.mark());
        return { context, parser };
    }

    public build(text: string): DocumentParseData {
        console.assert(typeof text !== 'undefined', `text cannot be undefined`);

        console.log(`building document "${this.fileName}"`);
        const inputStream = UCInputStream.fromString(text);
        const lexer = new UCLexer(inputStream);
        const errorListener = new UCErrorListener();
        lexer.removeErrorListeners(); lexer.addErrorListener(errorListener);
        const tokenStream = new UCTokenStream(lexer);
        const walker = new DocumentASTWalker(this, this.scope, tokenStream);

        if (config.generation === UCGeneration.UC3) {
            const startPreprocressing = performance.now();
            const macroParser = createPreprocessor(this, lexer);
            lexer.reset();
            if (macroParser) {
                try {
                    const macroTree = preprocessDocument(this, macroParser, walker);
                    if (macroTree) {
                        tokenStream.initMacroTree(macroTree, errorListener);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    console.info(`${this.fileName}: preprocessing time ${performance.now() - startPreprocressing}`);
                }
            }
        }

        const startWalking = performance.now();
        // tokenStream.fill();

        let context: ProgramContext | undefined;
        const parser = new UCParser(tokenStream);
        parser.generation = config.generation === '3'
            ? 3 : config.generation === '2'
                ? 2 : config.generation === '1'
                    ? 1 : 3;
        parser.licensee = config.licensee as unknown as Licensee;
        try {
            parser.interpreter.setPredictionMode(PredictionMode.SLL);
            parser.errorHandler = ERROR_STRATEGY;
            parser.removeErrorListeners(); parser.addErrorListener(errorListener);
            context = parser.program();
        } catch (err) {
            console.debug('PredictionMode SLL has failed, rolling back to LL.');
            try {
                errorListener.nodes = [];
                parser.reset();
                parser.interpreter.setPredictionMode(PredictionMode.LL);
                parser.errorHandler = ERROR_STRATEGY;
                parser.removeErrorListeners(); parser.addErrorListener(errorListener);
                context = parser.program();
            } catch (err) {
                console.error(
                    `An error was thrown while parsing document: "${this.uri}"`,
                    err
                );
            }
        } finally {
            try {
                parser.reset(true);
                if (context) {
                    walker.visit(context);
                }
            } catch (err) {
                console.error(
                    `An error was thrown while transforming document: "${this.uri}"`,
                    err
                );
            }
            console.info(`${this.fileName}: transforming time ${performance.now() - startWalking}`);
        }
        tokenStream.release(tokenStream.mark());
        this.nodes = this.nodes.concat(errorListener.nodes);
        return { context, parser };
    }

    public invalidate(cleanup = true) {
        if (cleanup) {
            // Remove hashed objects from the global objects table.
            // This however does not invoke any invalidation calls to dependencies.
            // TODO: Merge this with scope.clear();
            if (this.class) {
                removeChildren(this.class);
                removeHashedSymbol(this.class);
            }
        }
        this.class = undefined;
        this.scope.clear();
        this.nodes = []; // clear
        this.hasBeenBuilt = false;
        this.hasBeenIndexed = false;

        // Clear all the indexed references that we have made.
        for (const [key, value] of this.indexReferencesMade) {
            const refs = IndexedReferencesMap.get(key);
            if (refs) {
                for (const ref of value) {
                    refs.delete(ref);
                }
            }
        }
        this.indexReferencesMade.clear();
    }

    indexReference(symbol: ISymbol, ref: SymbolReference) {
        const key = symbol.getHash();
        const value = this.indexReferencesMade.get(key);

        const set = value ?? new Set<SymbolReference>();
        set.add(ref);

        if (!value) {
            this.indexReferencesMade.set(key, set);
        }

        // TODO: Refactor this, we are pretty much duplicating this function's job.
        const gRefs = IndexedReferencesMap.get(key) ?? new Set<SymbolReference>();
        gRefs.add(ref);
        IndexedReferencesMap.set(key, gRefs);
    }

    getReferencesToSymbol(symbol: ISymbol): Set<SymbolReference> | undefined {
        return this.indexReferencesMade.get(symbol.getHash());
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDocument(this);
    }
}

export function createPreprocessor(document: UCDocument, lexer: UCLexer) {
    const macroStream = new CommonTokenStream(lexer, UCLexer.MACRO);
    macroStream.fill();

    if (macroStream.getNumberOfOnChannelTokens() <= 1) {
        return undefined;
    }

    const macroParser = new UCPreprocessorParser(macroStream);
    macroParser.filePath = document.uri;
    return macroParser;
}

export function preprocessDocument(document: UCDocument, macroParser: UCPreprocessorParser, walker?: DocumentASTWalker) {
    if (document.fileName.toLowerCase() === 'globals.uci') {
        UCPreprocessorParser.globalSymbols = macroParser.currentSymbols;
        applyMacroSymbols(config.macroSymbols);
    }

    // Cannot use document.Name, because we need to preserve lowercases and uppercases
    const classNameMacro = { text: path.basename(document.fileName, path.extname(document.fileName)) };
    macroParser.currentSymbols.set("classname", classNameMacro);

    const packageNameMacro = { text: document.classPackage.getName().text };
    macroParser.currentSymbols.set("packagename", packageNameMacro);

    if (walker) {
        const errorListener = new UCErrorListener();
        macroParser.removeErrorListeners(); macroParser.addErrorListener(errorListener);
    }
    const macroCtx = macroParser.macroProgram();
    if (walker) {
        walker.visit(macroCtx);
    }
    return macroCtx;
}
