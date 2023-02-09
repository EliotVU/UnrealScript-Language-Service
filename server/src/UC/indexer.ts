import path from 'path';
import { performance } from 'perf_hooks';
import { Subject } from 'rxjs';
import { Location } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { EAnalyzeOption, UCLanguageServerSettings } from '../settings';
import { UCPreprocessorParser } from './antlr/generated/UCPreprocessorParser';
import { UCDocument } from './document';
import { DocumentIndexer } from './documentIndexer';
import { Name, NameHash, toName } from './name';
import {
    addHashedSymbol,
    ISymbol,
    ObjectsTable,
    SymbolReference,
    TRANSIENT_PACKAGE,
    UCEnumMemberSymbol,
    UCPackage,
    UCSymbolKind,
} from './Symbols';

export const documentsByPathMap = new Map<string, UCDocument>();
export const documentsMap = new Map<NameHash, UCDocument>();

export enum UCGeneration {
    Auto = 'auto',
    UC1 = '1',
    UC2 = '2',
    UC3 = '3'
}

export const enum UELicensee {
    Epic = 'Epic',
    XCom = 'XCom',
}

export type IntrinsicSymbolItemMap = {
    [key: string]: {
        type?: string;
        extends?: string;
    }
}

export type UCLanguageSettings = {
    generation: UCGeneration;
    licensee: UELicensee;
    checkTypes?: boolean;
    macroSymbols?: {
        [key: string]: string
    };
    intrinsicSymbols: IntrinsicSymbolItemMap
}

export const defaultSettings: UCLanguageServerSettings = {
    generation: UCGeneration.UC3,
    licensee: UELicensee.Epic,
    analyzeDocuments: EAnalyzeOption.OnlyActive,
    checkTypes: false,
    macroSymbols: {
        'debug': ''
    },
    intrinsicSymbols: {

    }
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

/**
 * Emits an array of documents that have been linked, but are yet to be post-linked.
 * This array is filled by the documentLinked$ listener.
 **/
export const lastIndexedDocuments$ = new Subject<UCDocument[]>();
let pendingIndexedDocuments: UCDocument[] = [];

export function indexDocument(document: UCDocument, text?: string): void {
    try {
        document.build(text);
        document.hasBeenIndexed = true;
        const start = performance.now();
        try {
            if (document.class) {
                for (let symbol of document.enumerateSymbols()) {
                    symbol.index(document, document.class);
                }
            }
        } catch (err) {
            console.error(
                `(symbol index error) in document "${document.uri}"`,
                err
            );
        }
        console.info(`${document.fileName}: indexing time ${performance.now() - start}`);
        pendingIndexedDocuments.push(document);
    } catch (err) {
        console.error(`(index error) in document ${document.uri}`, err);
    }
}

// To be initiated after we have indexed all dependencies, so that deep recursive context references can be resolved.
function postIndexDocument(document: UCDocument) {
    try {
        const indexer = new DocumentIndexer(document);
        indexer.visitDocument(document);
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

    lastIndexedDocuments$.next(pendingIndexedDocuments);
    // Don't splice in place, it's crucial we preserve the elements for subscription listeners.
    pendingIndexedDocuments = [];
}

export function getPendingDocumentsCount(): number {
    return pendingIndexedDocuments.length;
}

const sepRegex = RegExp(`\\${path.sep}`);
export function parsePackageNameInDir(dir: string): string | undefined {
    const directories = dir.split(sepRegex);
    for (let i = directories.length - 1; i >= 0; --i) {
        if (i > 0 && directories[i].toLowerCase() === 'classes') {
            return directories[i - 1];
        }
    }
    return undefined;
}

export function createPackageByDir(dir: string): UCPackage {
    const pkgNameStr = parsePackageNameInDir(dir);
    if (typeof pkgNameStr === 'undefined') {
        return TRANSIENT_PACKAGE;
    }
    return createPackage(pkgNameStr);
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
    documentsByPathMap.set(filePath, document);
    documentsMap.set(document.name.hash, document);
    return document;
}

export function removeDocumentByPath(filePath: string) {
    const document = documentsByPathMap.get(filePath);
    if (!document) {
        return;
    }

    // TODO: Re-index dependencies? (blocked by lack of a dependencies tree!)
    document.invalidate();
    documentsByPathMap.delete(filePath);
    documentsMap.delete(document.name.hash);
}

export function getDocumentByURI(uri: string): UCDocument | undefined {
    const filePath = URI.parse(uri).fsPath;
    const document = documentsByPathMap.get(filePath);
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
    const ref: SymbolReference = { location };
    document.indexReference(symbol, ref);
    return ref;
}

export function indexDeclarationReference(symbol: ISymbol, document: UCDocument): SymbolReference {
    const ref: SymbolReference = {
        location: Location.create(document.uri, symbol.id.range),
        inAssignment: true
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