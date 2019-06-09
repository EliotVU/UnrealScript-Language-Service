import * as fs from 'fs';
import * as path from 'path';

import URI from 'vscode-uri';
import { CompletionItem, CompletionItemKind, RemoteWorkspace, Connection } from 'vscode-languageserver';
import { BehaviorSubject } from 'rxjs';

import { ISymbolReference, UCPackage, SymbolsTable, UCEnumMemberSymbol } from './Symbols';
import { UCDocument } from './document';
import { Name } from './names';

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

let ClassCompletionItems: CompletionItem[] = [];

ClassNameToFilePathMap$.subscribe(classesMap => {
	ClassCompletionItems = Array.from(classesMap.values())
		.map(value => {
			return {
				label: path.basename(value, '.uc'),
				kind: CompletionItemKind.Class
			};
		});
});

export function getUriById(qualifiedClassId: string): string | undefined {
	const filePath = ClassNameToFilePathMap$.getValue().get(qualifiedClassId);
	return filePath ? URI.file(filePath).toString() : undefined;
}

export const IndexedReferencesMap = new Map<string, Set<ISymbolReference>>();

export function getIndexedReferences(qualifiedId: string) {
	return IndexedReferencesMap.get(qualifiedId);
}

const EnumMemberMap = new Map<Name, UCEnumMemberSymbol>();

export function getEnumMember(enumMember: Name): UCEnumMemberSymbol | undefined {
	return EnumMemberMap.get(enumMember);
}

export function setEnumMember(enumMember: UCEnumMemberSymbol) {
	EnumMemberMap.set(enumMember.getId(), enumMember);
}

async function buildClassesFilePathsMap(workspace: RemoteWorkspace): Promise<Map<string, string>> {
	function scanPath(filePath: string, cb: (filePath: string) => void): Promise<boolean> {
		const promise = new Promise<boolean>((resolve) => {
			if (!fs.existsSync(filePath)) {
				resolve(false);
				return;
			}

			fs.lstat(filePath, (err, stats) => {
				if (stats.isDirectory()) {
					fs.readdir(filePath, (err, filePaths) => {
						for (let fileName of filePaths) {
							resolve(scanPath(path.join(filePath, fileName), cb));
						}
					});
				} else {
					if (path.extname(filePath) === '.uc') {
						cb(filePath);
					}
					resolve(true);
				}
			});
		});
		return promise;
	}

	const filePaths = new Map<string, string>();
	const folders = await workspace.getWorkspaceFolders();
	if (folders) {
		for (let folder of folders) {
			const folderPath = URI.parse(folder.uri).fsPath;
			await scanPath(folderPath, (filePath => {
				filePaths.set(path.basename(filePath, '.uc').toLowerCase(), filePath);
			}));
		}
	}
	return filePaths;
}

export async function initWorkspace(connection: Connection) {
	const filePathMap = await buildClassesFilePathsMap(connection.workspace);
	ClassNameToFilePathMap$.next(filePathMap);
}