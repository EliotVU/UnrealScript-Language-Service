import * as path from 'path';

import URI from 'vscode-uri';
import { BehaviorSubject } from 'rxjs';

import { ISymbolReference, UCPackage, PackagesTable, UCEnumMemberSymbol } from './Symbols';
import { UCDocument } from './document';
import { Name, toName } from './names';

export const filePathByClassIdMap$ = new BehaviorSubject(new Map<string, string>());
export const documentByURIMap = new Map<string, UCDocument>();
const packageByDirMap = new Map<string, UCPackage>();

export enum UCGeneration {
	UC1 = "1",
	UC2 = "2",
	UC3 = "3"
}

export const config: { generation: UCGeneration } = {
	generation: UCGeneration.UC3
};

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
		return PackagesTable;
	}

	pkg = new UCPackage(toName(packageName));
	PackagesTable.addSymbol(pkg);
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

export function indexDocument(document: UCDocument, text?: string): UCDocument | undefined {
	try {
		document.build(text);
		if (document.class) {
			document.link();
		} else {
			console.warn("Indexed a document with no class!", document.filePath);
		}
		return document;
	} catch (err) {
		console.error(`An error occurred during the indexation of document ${document.filePath}`, err);
		return undefined;
	}
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

export const IndexedReferencesMap = new Map<string, Set<ISymbolReference>>();

export function getIndexedReferences(qualifiedId: string) {
	return IndexedReferencesMap.get(qualifiedId);
}

const EnumMemberMap = new WeakMap<Name, UCEnumMemberSymbol>();

export function getEnumMember(enumName: Name): UCEnumMemberSymbol | undefined {
	return EnumMemberMap.get(enumName);
}

export function setEnumMember(enumMember: UCEnumMemberSymbol) {
	EnumMemberMap.set(enumMember.getId(), enumMember);
}