import * as path from 'path';
import URI from 'vscode-uri';

import { BehaviorSubject } from 'rxjs';

import { ISymbolReference, UCPackage, SymbolsTable, UCEnumMemberSymbol } from './Symbols';
import { UCDocument } from './document';

function findPackageNameInDir(dir: string): string {
	const directories = dir.split('/');
	for (let i = directories.length - 1; i >= 0; -- i) {
		if (i > 0 && directories[i].toLowerCase() === 'classes') {
			return directories[i - 1];
		}
	}
	return '';
}

const DirPackageMap = new Map<string, UCPackage>();
function getPackageByUri(documentUri: string): UCPackage {
	const dir = path.parse(documentUri).dir;
	let pkg = DirPackageMap.get(dir);
	if (pkg) {
		return pkg;
	}

	const packageName = findPackageNameInDir(dir);
	if (!packageName) {
		return SymbolsTable;
	}

	pkg = new UCPackage(packageName);
	SymbolsTable.addSymbol(pkg);
	DirPackageMap.set(dir, pkg);
	return pkg;
}

export const ClassNameToDocumentMap: Map<string, UCDocument> = new Map<string, UCDocument>();
export function getDocumentByUri(uri: string): UCDocument {
	let document = ClassNameToDocumentMap.get(uri);
	if (document) {
		return document;
	}

	const pkg = getPackageByUri(uri);
	document = new UCDocument(uri, pkg);
	ClassNameToDocumentMap.set(uri, document);
	return document;
}

export function getDocumentById(qualifiedId: string): UCDocument | undefined {
	const uri = getUriById(qualifiedId);
	if (!uri) {
		return undefined;
	}

	const document: UCDocument = getDocumentByUri(uri);
	return document;
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

export const ClassNameToFilePathMap$ = new BehaviorSubject(new Map<string, string>());

export function getUriById(qualifiedClassId: string): string | undefined {
	const filePath = ClassNameToFilePathMap$.getValue().get(qualifiedClassId);
	return filePath ? URI.file(filePath).toString() : undefined;
}

export const IndexedReferences = new Map<string, Set<ISymbolReference>>();

export function getIndexedReferences(qualifiedId: string) {
	return IndexedReferences.get(qualifiedId);
}

const EnumMemberMap = new Map<string, UCEnumMemberSymbol>();

export function getEnumMember(enumMember: string): UCEnumMemberSymbol | undefined {
	return EnumMemberMap.get(enumMember);
}

export function setEnumMember(enumMember: UCEnumMemberSymbol) {
	EnumMemberMap.set(enumMember.getId(), enumMember);
}