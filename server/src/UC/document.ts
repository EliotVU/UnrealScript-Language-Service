import { PredictionMode } from 'antlr4ts/atn/PredictionMode';
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { DocumentUri } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { UCErrorListener } from './Parser/ErrorListener';
import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import type { ExternalToken } from './Parser/ExternalTokenFactory';
import { UCInputStream } from './Parser/InputStream';
import { MacroProvider, createMacroProvider } from './Parser/MacroProvider';
import { IntrinsicGlobalMacroProvider } from './Parser/PreprocessorParser';
import { createTokenStream } from './Parser/PreprocessorParser';
import { UCPreprocessorTokenStream } from './Parser/PreprocessorTokenStream';
import {
    ISymbol,
    SymbolReference,
    SymbolsTable,
    UCClassSymbol,
    UCObjectSymbol,
    UCPackage,
    UCStructSymbol,
    UCSymbolKind,
    isArchetypeSymbol,
    isClassSymbol,
    removeHashedSymbol,
} from './Symbols';
import { UCLexer } from './antlr/generated/UCLexer';
import { Licensee, ProgramContext, UCParser } from './antlr/generated/UCParser';
import { IDiagnosticNode } from './diagnostics/diagnostic';
import { DocumentASTWalker } from './documentASTWalker';
import { IndexedReferencesMap, config, createDocumentByPath, getDocumentById, indexDocument, queueIndexDocument, resolveGlobalsFilePath } from './indexer';
import { Name, NameHash, toName } from './name';
import { UCGeneration } from './settings';
import { SymbolWalker } from './symbolWalker';
import { NAME_CORE, NAME_OBJECT } from './names';

function removeChildren(scope: UCStructSymbol) {
    for (let child = scope.children; child; child = child.next) {
        switch (child.kind) {
            case UCSymbolKind.Enum:
                removeHashedSymbol(child);
                break;

            case UCSymbolKind.ScriptStruct:
                // inner structs...
                removeChildren(child as UCStructSymbol);
                removeHashedSymbol(child);
                break;

            case UCSymbolKind.Archetype:
                // inner archetypes...
                removeChildren(child as UCStructSymbol);
                removeHashedSymbol(child);
                break;
        }
    }

    if (isClassSymbol(scope) && isArchetypeSymbol(scope.defaults)) {
        removeChildren(scope.defaults);
    }

    removeHashedSymbol(scope);
}

export type DocumentParseData = {
    context: ProgramContext | undefined;
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
    public indexedVersion = -1;

    // TODO: Displace this with a DiagnosticCollection visitor.
    public nodes: IDiagnosticNode[] = [];

    /** The class or interface header symbol */
    public class?: UCClassSymbol = undefined;
    public hasBeenBuilt = false;
    public hasBeenIndexed = false;

    /** Array of tokens that were processed by the lexer. Special use case for .uci files. */
    public tokensCache?: ExternalToken[];

    public macroProvider?: MacroProvider;

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
        if (process.env.NODE_ENV !== 'test') {
            lexer.removeErrorListeners();
        }

        if (config.generation === UCGeneration.UC3) {
            // TODO: use URI (for web version)
            const globalsFilePath = resolveGlobalsFilePath(this.filePath);
            let globalsDocument: UCDocument | undefined = undefined;
            if (fs.existsSync(globalsFilePath)) {
                globalsDocument = createDocumentByPath(globalsFilePath, this.classPackage);
                indexDocument(globalsDocument);
            }

            this.macroProvider ??= createMacroProvider(this, undefined, globalsDocument?.macroProvider);
        }

        const tokenStream = createTokenStream(lexer, this.macroProvider);

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

        return { context: context, parser };
    }

    public build(text: string): DocumentParseData {
        console.assert(typeof text !== 'undefined', `text cannot be undefined`);

        console.log(`building document "${this.fileName}"`);
        const inputStream = UCInputStream.fromString(text);
        const lexer = new UCLexer(inputStream);
        const errorListener = new UCErrorListener();
        if (process.env.NODE_ENV !== 'test') {
            lexer.removeErrorListeners();
        }
        lexer.addErrorListener(errorListener);

        if (config.generation === UCGeneration.UC3) {
            let packageGlobalsDocument: UCDocument | undefined = undefined;
            let superMacroProvider: MacroProvider | undefined = undefined;
            let globalsMacroProvider: MacroProvider | undefined = undefined;

            // TODO: use URI (for web version)
            // Get the appropriate Globals.uci for this *.uc document.
            const packageGlobalsFilePath = resolveGlobalsFilePath(this.filePath);
            const isGlobalDocument = this.filePath === packageGlobalsFilePath;
            const hasPackageGlobalsFile = fs.existsSync(packageGlobalsFilePath);

            // Most packages don't have their own "Globals.uci" file
            if (hasPackageGlobalsFile) {
                packageGlobalsDocument = createDocumentByPath(packageGlobalsFilePath, this.classPackage);
            }

            // Ensure we have this macro provider before we index our "MyPackage/Globals.uci"
            if (isGlobalDocument) {
                if (this.classPackage.getName() === NAME_CORE) {
                    // this is the "Core/Globals.uci" document, make it inherit from the true Globals (defined by the user)
                    globalsMacroProvider = IntrinsicGlobalMacroProvider;
                } else {
                    // Find the "Core/Globals.uci" document that we have to supposedly concatenate (as per the UnrealScript compiler, but we can't really do that)
                    // -- so that it can access the macros defined in "Core/Globals.uci"
                    const objectDocument = getDocumentById(NAME_OBJECT);
                    if (objectDocument) {
                        if (!objectDocument.hasBeenBuilt
                            && typeof objectDocument.macroProvider === 'undefined') {
                            queueIndexDocument(objectDocument);
                        }

                        superMacroProvider = objectDocument.macroProvider?.globalsMacroProvider;
                    }
                }

                // TODO: Should we always override? Imagine a document is updated after a new "Globals.uci" has been added?
                this.macroProvider ??= createMacroProvider(this, superMacroProvider, globalsMacroProvider);
            } else {
                // No "Globals.uci" for the current class package, use the "Core/Globals.uci"
                if (typeof packageGlobalsDocument === 'undefined') {
                    const objectDocument = getDocumentById(NAME_OBJECT);
                    if (objectDocument) {
                        if (!objectDocument.hasBeenBuilt
                            && typeof objectDocument.macroProvider === 'undefined') {
                            queueIndexDocument(objectDocument);
                        }

                        globalsMacroProvider = objectDocument.macroProvider?.globalsMacroProvider;
                    }
                } else {
                    if (!packageGlobalsDocument.hasBeenIndexed
                        && typeof packageGlobalsDocument.macroProvider === 'undefined') {
                        queueIndexDocument(packageGlobalsDocument);
                    }

                    globalsMacroProvider = packageGlobalsDocument?.macroProvider;
                }
            }

            this.macroProvider ??= createMacroProvider(this, undefined, globalsMacroProvider);
        }

        const tokenStream = createTokenStream(lexer, this.macroProvider);
        if (tokenStream instanceof UCPreprocessorTokenStream) {
            tokenStream.macroParser.addErrorListener(errorListener)
        }

        const walker = new DocumentASTWalker(this, this.scope, tokenStream);
        const startWalking = performance.now();

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
            if (process.env.NODE_ENV !== 'test') {
                parser.removeErrorListeners();
            }
            parser.addErrorListener(errorListener);
            context = parser.program();
        } catch (err) {
            console.debug('PredictionMode SLL has failed, rolling back to LL.');
            try {
                errorListener.nodes = [];
                parser.reset();
                parser.interpreter.setPredictionMode(PredictionMode.LL);
                parser.errorHandler = ERROR_STRATEGY;
                if (process.env.NODE_ENV !== 'test') {
                    parser.removeErrorListeners();
                }
                parser.addErrorListener(errorListener);
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
        this.nodes = this.nodes.concat(errorListener.nodes);

        return { context: context, parser };
    }

    public invalidate(cleanup = true) {
        // const startCleaning = performance.now();
        if (cleanup) {
            // Remove hashed objects from the global objects table.
            // This however does not invoke any invalidation calls to dependencies.
            // TODO: Merge this with scope.clear();
            if (this.class) {
                removeChildren(this.class);
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
        // console.info(`${this.fileName}: cleaning time ${performance.now() - startCleaning}`);
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
