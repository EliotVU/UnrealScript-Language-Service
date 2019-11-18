import * as path from 'path';

import { URI } from 'vscode-uri';
import { BehaviorSubject, Subject } from 'rxjs';
import { performance } from 'perf_hooks';

import { UCOptions, ServerSettings, EAnalyzeOption } from '../settings';
import { UCPreprocessorParser } from '../antlr/UCPreprocessorParser';

import { ISymbolReference, UCPackage, TRANSIENT_PACKAGE, UCEnumMemberSymbol, ObjectsTable } from './Symbols';
import { UCDocument } from './document';
import { Name, toName } from './names';
import { DocumentIndexer } from './documentIndexer';

export const filePathByClassIdMap$ = new BehaviorSubject(new Map<string, string>());
export const documentByURIMap = new Map<string, UCDocument>();
const packageByDirMap = new Map<string, UCPackage>();

export enum UCGeneration {
	UC1 = "1",
	UC2 = "2",
	UC3 = "3"
}

export const defaultSettings: ServerSettings = {
	unrealscript: {
		generation: UCGeneration.UC3,
		indexAllDocuments: false,
		analyzeDocuments: EAnalyzeOption.OnlyActive,
		checkTypes: false,
		macroSymbols: {
			"debug": ""
		},
		intrinsicSymbols: {

		}
	}
};

export const config: UCOptions = Object.assign({}, defaultSettings.unrealscript);

export function applyMacroSymbols(symbols?: { [key: string]: string }) {
	UCPreprocessorParser.globalSymbols.clear();
	if (symbols) {
		// Apply our custom-macros as global symbols (accessable in any uc file).
		const entries = Object.entries<string>(symbols);
		for (let [key, value] of entries) {
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

export function indexDocument(document: UCDocument, text?: string) {
	try {
		document.build(text);

		document.hasBeenIndexed = true;
		const start = performance.now();
		if (document.class) {
			try {
				document.class.index(document, document.class);
			} catch (err) {
				console.error(
					`An error was thrown while indexing document: "${document.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		}
		console.info(document.fileName + ': indexing time ' + (performance.now() - start));

		pendingIndexedDocuments.push(document);

		// See postLink() below.
	} catch (err) {
		console.error(`An error occurred during the indexation of document ${document.filePath}`, err);
	}
}

// To be initiated after we have indexed all dependencies, so that deep recursive context references can be resolved.
function postIndexDocument(document: UCDocument) {
	if (document.class) {
		try {
			const indexer = new DocumentIndexer(document);
			document.class.accept<any>(indexer);
		} catch (err) {
			console.error(
				`An error was thrown while post indexing document: "${document.filePath}",
				\n
				\t stack: "${err.stack}"`
			);
		}
	}
}

export function queuIndexDocument(document: UCDocument, text?: string) {
	indexDocument(document, text);

	if (pendingIndexedDocuments) {
		const startTime = performance.now();
		for (const doc of pendingIndexedDocuments) {
			postIndexDocument(doc);
		}
		console.info(`[${pendingIndexedDocuments.map(doc => doc.fileName).join()}]: post indexing time ${(performance.now() - startTime)}`);

		lastIndexedDocuments$.next(pendingIndexedDocuments);
		pendingIndexedDocuments = [];
	}
}

function findPackageNameInDir(dir: string): string {
	const directories = dir.split('/');
	for (let i = directories.length - 1; i >= 0; -- i) {
		if (i > 0 && directories[i].toLowerCase() === 'classes') {
			return directories[i - 1];
		}
	}
	return '';
}

function getPackageByUri(uri: string): UCPackage {
	const dir = path.parse(uri).dir;
	let pkg = packageByDirMap.get(dir);
	if (pkg) {
		return pkg;
	}

	const packageName = findPackageNameInDir(dir);
	if (!packageName) {
		return TRANSIENT_PACKAGE;
	}

	pkg = new UCPackage(toName(packageName));
	ObjectsTable.addSymbol(pkg);
	packageByDirMap.set(dir, pkg);
	return pkg;
}

export function getDocumentByUri(uri: string): UCDocument {
	let document = documentByURIMap.get(uri);
	if (document) {
		return document;
	}

	const pkg = getPackageByUri(uri);
	document = new UCDocument(uri, pkg);
	documentByURIMap.set(uri, document);
	return document;
}

export function getUriById(id: string): string | undefined {
	const filePath = filePathByClassIdMap$.getValue().get(id);
	return filePath ? URI.file(filePath).toString() : undefined;
}

export function getDocumentById(id: string): UCDocument | undefined {
	const uri = getUriById(id);
	if (!uri) {
		return undefined;
	}
	return getDocumentByUri(uri);
}

// let ClassCompletionItems: CompletionItem[] = [];

// ClassIdToFilePathMap$.subscribe(classesMap => {
// 	ClassCompletionItems = Array.from(classesMap.values())
// 		.map(value => {
// 			return {
// 				label: path.basename(value, '.uc'),
// 				kind: CompletionItemKind.Class
// 			};
// 		});
// });

export const IndexedReferencesMap = new Map<number, Set<ISymbolReference>>();

export function getIndexedReferences(hash: number) {
	return IndexedReferencesMap.get(hash);
}

const EnumMemberMap = new WeakMap<Name, UCEnumMemberSymbol>();

export function getEnumMember(enumName: Name): UCEnumMemberSymbol | undefined {
	return EnumMemberMap.get(enumName);
}

export function setEnumMember(enumMember: UCEnumMemberSymbol) {
	EnumMemberMap.set(enumMember.getId(), enumMember);
}