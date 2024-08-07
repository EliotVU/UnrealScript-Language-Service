import path from 'path';
import { performance } from 'perf_hooks';
import { Subject } from 'rxjs';
import * as url from 'url';
import { Location } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { UCGeneration, UELicensee } from "./settings";

import { ActiveTextDocuments } from '../activeTextDocuments';
import { EAnalyzeOption, UCLanguageServerSettings } from '../configuration';
import { readTextByURI } from '../workspace';
import {
    ISymbol,
    ObjectsTable,
    SymbolReference,
    SymbolReferenceFlags,
    UCConstSymbol,
    UCEnumMemberSymbol,
    UCPackage,
    UCSymbolKind,
    addHashedSymbol,
} from './Symbols';
import { UCPreprocessorParser } from './antlr/generated/UCPreprocessorParser';
import { UCDocument } from './document';
import { DocumentCodeIndexer, DocumentSymbolIndexer } from './documentCodeIndexer';
import { Name, NameHash, toName } from './name';

// TODO: Re-work to hash documents by URI instead of file path, this would integrate easier with LSP events.
export const documentsByPathMap = new Map<string, UCDocument>();
export const documentsMap = new Map<NameHash, UCDocument>();

export const defaultSettings: UCLanguageServerSettings = {
    generation: UCGeneration.UC3,
    licensee: UELicensee.Epic,
    checkTypes: true,
    macroSymbols: {
        'debug': ''
    },
    intrinsicSymbols: {

    },
    analyzeDocuments: EAnalyzeOption.OnlyActive,
    analyzeDocumentDebouncePeriod: 50,
    indexAllDocuments: false,
    indexDocumentDebouncePeriod: 50
};

export const config: UCLanguageServerSettings = Object.assign({}, defaultSettings);

export function clearMacroSymbols() {
    UCPreprocessorParser.globalSymbols.clear();
}

export function applyMacroSymbols(symbols?: { [key: string]: string }) {
    if (symbols) {
        // Apply our custom-macros as global symbols (accessable in any uc file).
        const entries = Object.entries<string>(symbols);
        for (const [key, value] of entries) {
            UCPreprocessorParser.globalSymbols.set(key.toLowerCase(), { text: value });
        }
    }
}

let pendingIndexedDocuments: UCDocument[] = [];

/** Emits a document that has been built. */
export const documentBuilt$ = new Subject<UCDocument>();

/** Emits a document that has been indexed. */
export const documentIndexed$ = new Subject<UCDocument>();

/** Emits an array of documents that have been post-indexed (code indexing). */
export const documentsCodeIndexed$ = new Subject<UCDocument[]>();

export function indexDocument(document: UCDocument, text?: string): void {
    const buildStart = performance.now();
    let buildTime: number;
    let indexedVersion: number | undefined;

    if (typeof text === 'undefined') {
        // Let's fetch the text from the file system, but first see if we have an active text document (this ensures we retrieve the latest revision)
        const textDocument = ActiveTextDocuments.get(document.uri);
        if (textDocument) {
            text = textDocument.getText();
            indexedVersion = textDocument.version;
        } else {
            text = readTextByURI(document.uri);
        }
    }

    try {
        document.build(text);
        document.hasBeenBuilt = true;
        documentBuilt$.next(document);
    } catch (err) {
        console.error(`(build error) in document "${document.uri}"; Indexing has been annulled.`, err);
        return;
    } finally {
        buildTime = performance.now() - buildStart;
    }

    const indexStart = performance.now();
    try {
        const indexer = new DocumentSymbolIndexer(document);
        // We set this here to prevent any re-triggering within the following indexing process.
        document.hasBeenIndexed = true;
        if (indexedVersion) document.indexedVersion = indexedVersion;
        document.accept(indexer);
    } catch (err) {
        console.error(
            `(symbol index error) in document "${document.uri}"`,
            err
        );
    } finally {
        console.info(`${document.fileName}: build time: ${buildTime}; indexing time ${performance.now() - indexStart}`);
        pendingIndexedDocuments.push(document);
        documentIndexed$.next(document);
    }
}

// To be initiated after we have indexed all dependencies, so that deep recursive context references can be resolved.
function postIndexDocument(document: UCDocument) {
    try {
        const indexer = new DocumentCodeIndexer(document);
        document.accept(indexer);
    } catch (err) {
        console.error(
            `(post-index error) in document "${document.uri}"`,
            err
        );
    }
}

export function queueIndexDocument(document: UCDocument, text?: string): void {
    indexDocument(document, text);
    indexPendingDocuments(undefined);
}

export function indexPendingDocuments(abort?: (document: UCDocument) => boolean): void {
    if (!pendingIndexedDocuments.length) {
        return;
    }

    const startTime = performance.now();
    for (const document of pendingIndexedDocuments) {
        if (abort?.(document)) {
            // Maybe preserve the array's elements?
            break;
        }
        postIndexDocument(document);
    }

    const dependenciesSequence = pendingIndexedDocuments
        .map(doc => doc.fileName)
        .join();
    console.info(`[${dependenciesSequence}]: post indexing time ${(performance.now() - startTime)}`);

    documentsCodeIndexed$.next(pendingIndexedDocuments);
    // Don't splice in place, it's crucial we preserve the elements for subscription listeners.
    pendingIndexedDocuments = [];
}

export function getPendingDocumentsCount(): number {
    return pendingIndexedDocuments.length;
}

const sepRegex = RegExp(`\\${path.sep}`);
export function parsePackageNameInDir(dir: string): string {
    const directories = dir.split(sepRegex);
    for (let i = directories.length - 1; i >= 0; --i) {
        if (i > 0 && directories[i].match(/classes/i)) {
            return directories[i - 1];
        }
    }

    // Use the first directory (from right to left) as the package name.
    return path.basename(path.dirname(dir));
}

export function createPackageByDir(dir: string): UCPackage {
    return createPackage(parsePackageNameInDir(dir));
}

export function createPackage(pkgNameStr: string): UCPackage {
    const pkgName = toName(pkgNameStr);
    let pkg = ObjectsTable.getSymbol<UCPackage>(pkgName, UCSymbolKind.Package);
    if (!pkg) {
        pkg = new UCPackage(pkgName);
        addHashedSymbol(pkg);
    }
    return pkg;
}

export function createDocumentByPath(filePath: string, pkg: UCPackage) {
    let document = documentsByPathMap.get(filePath);
    if (document) {
        return document;
    }

    document = new UCDocument(filePath, pkg);
    // FIXME: Temporary fix around Glob 9.*, for some reason it returns results with cases that do not match its root input...
    documentsByPathMap.set(filePath.toLowerCase(), document);
    documentsMap.set(document.name.hash, document);
    return document;
}

export function removeDocumentByPath(filePath: string): boolean {
    const filePathLowerCase = filePath.toLowerCase();
    const document = documentsByPathMap.get(filePathLowerCase);
    if (!document) {
        return false;
    }

    // TODO: Re-index dependencies? (blocked by lack of a dependencies tree!)
    document.invalidate();
    documentsByPathMap.delete(filePathLowerCase);
    documentsMap.delete(document.name.hash);
    return true;
}

export function getDocumentByURI(uri: DocumentUri): UCDocument | undefined {
    const filePathLowerCase = url.fileURLToPath(uri).toLowerCase();
    const document = documentsByPathMap.get(filePathLowerCase);
    return document;
}

/** Returns a mapped document by name (excluding the extension, unless it is a .uci file) */
export function getDocumentById(id: Name): UCDocument | undefined {
    return documentsMap.get(id.hash);
}

export function enumerateDocuments(): IterableIterator<UCDocument> {
    return documentsMap.values();
}

export const IndexedReferencesMap = new Map<NameHash, Set<SymbolReference>>();
export function getIndexedReferences(hash: NameHash) {
    return IndexedReferencesMap.get(hash);
}

export function indexReference(symbol: ISymbol, document: UCDocument, location: Location): SymbolReference {
    const ref: SymbolReference = {
        location,
        flags: SymbolReferenceFlags.None
    };
    document.indexReference(symbol, ref);
    return ref;
}

export function indexDeclarationReference(symbol: ISymbol, document: UCDocument): SymbolReference {
    const ref: SymbolReference = {
        location: Location.create(document.uri, symbol.id.range),
        flags: SymbolReferenceFlags.Declaration
    };
    document.indexReference(symbol, ref);
    return ref;
}

const EnumMemberMap = new Map<NameHash, UCEnumMemberSymbol>();
export function getEnumMember(enumMemberName: Name): UCEnumMemberSymbol | undefined {
    return EnumMemberMap.get(enumMemberName.hash);
}
export function setEnumMember(enumMember: UCEnumMemberSymbol) {
    EnumMemberMap.set(enumMember.getName().hash, enumMember);
}

/**
 * Find the first matching const, irregardless of scope.
 **/
export function getConstSymbol(name: Name): UCConstSymbol | undefined {
    return ObjectsTable.getSymbol(name, UCSymbolKind.Const);
}
