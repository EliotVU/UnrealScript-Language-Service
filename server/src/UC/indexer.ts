import { Subject } from 'rxjs';
import { performance } from 'perf_hooks';

import { UCOptions, ServerSettings, EAnalyzeOption } from '../settings';
import { UCPreprocessorParser } from '../antlr/UCPreprocessorParser';

import { ISymbolReference, UCPackage, TRANSIENT_PACKAGE, UCEnumMemberSymbol, ObjectsTable, addHashedSymbol, UCTypeFlags } from './Symbols';
import { UCDocument, DocumentParseData } from './document';
import { Name, toName } from './names';
import { DocumentIndexer } from './documentIndexer';
import { URI } from 'vscode-uri';
import { UCParser } from '../antlr/UCParser';

export const documentsByPathMap = new Map<string, UCDocument>();
export const documentsMap = new Map<number, UCDocument>();

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

export function indexDocument(document: UCDocument, text?: string): DocumentParseData | undefined {
	try {
		const parseData = document.build(text);
		document.hasBeenIndexed = true;
		const start = performance.now();
		if (document.class) {
			try {
				document.class.index(document, document.class);
			} catch (err) {
				console.error(
					`An error was thrown while indexing document: "${document.uri}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		}
		console.info(document.fileName + ': indexing time ' + (performance.now() - start));
		pendingIndexedDocuments.push(document);
		return parseData;
	} catch (err) {
		console.error(`An error occurred during the indexation of document ${document.uri}`, err);
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
				`An error was thrown while post indexing document: "${document.uri}",
				\n
				\t stack: "${err.stack}"`
			);
		}
	}
}

export function queuIndexDocument(document: UCDocument, text?: string): DocumentParseData | undefined {
	const parseData = indexDocument(document, text);
	if (pendingIndexedDocuments) {
		const startTime = performance.now();
		for (const doc of pendingIndexedDocuments) {
			postIndexDocument(doc);
		}
		console.info(`[${pendingIndexedDocuments.map(doc => doc.fileName).join()}]: post indexing time ${(performance.now() - startTime)}`);

		lastIndexedDocuments$.next(pendingIndexedDocuments);
		pendingIndexedDocuments = [];
	}
	return parseData;
}

function parsePackageNameInDir(dir: string): string {
	const directories = dir.split(/\\|\//);
	for (let i = directories.length - 1; i >= 0; -- i) {
		if (i > 0 && directories[i].toLowerCase() === 'classes') {
			return directories[i - 1];
		}
	}
	return '';
}

export function getPackageByDir(dir: string): UCPackage {
	const pkgNameStr = parsePackageNameInDir(dir);
	if (!pkgNameStr) {
		return TRANSIENT_PACKAGE;
	}
	return createPackage(pkgNameStr);
}

export function createPackage(pkgNameStr: string): UCPackage {
	const pkgName = toName(pkgNameStr);
	let pkg = ObjectsTable.getSymbol<UCPackage>(pkgName, UCTypeFlags.Package);
	if (!pkg) {
		pkg = new UCPackage(pkgName);
		addHashedSymbol(pkg);
	}
	return pkg;
}

export function createDocument(filePath: string, pkg: UCPackage) {
	let document = documentsByPathMap.get(filePath);
	if (document) {
		return document;
	}

	document = new UCDocument(filePath, pkg);
	documentsByPathMap.set(filePath, document);
	documentsMap.set(document.name.hash, document);
	return document;
}

export function removeDocument(filePath: string) {
	const document = documentsByPathMap.get(filePath);
	if (!document) {
		return;
	}

	// TODO: Re-index dependencies? (blocked by lack of a dependencies tree!)
	document.invalidate();
	documentsByPathMap.delete(filePath);
	documentsMap.delete(document.name.hash);

	// TODO: See if our package has any remaining members, if not, try to remove the package.
	// if (document.classPackage) {

	// }
}

export function getDocumentByURI(uri: string): UCDocument | undefined {
	const filePath = URI.parse(uri).fsPath;
	const document = documentsByPathMap.get(filePath);
	return document;
}

export function getDocumentById(id: Name): UCDocument | undefined {
	return documentsMap.get(id.hash);
}

export const IndexedReferencesMap = new Map<number, Set<ISymbolReference>>();
export function getIndexedReferences(hash: number) {
	return IndexedReferencesMap.get(hash);
}

const EnumMemberMap = new Map<number, UCEnumMemberSymbol>();
export function getEnumMember(enumName: Name): UCEnumMemberSymbol | undefined {
	return EnumMemberMap.get(enumName.hash);
}
export function setEnumMember(enumMember: UCEnumMemberSymbol) {
	EnumMemberMap.set(enumMember.getName().hash, enumMember);
}