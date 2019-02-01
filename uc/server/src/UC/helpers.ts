import * as path from 'path';
import * as fs from 'fs';

import { BehaviorSubject } from 'rxjs';

import URI from 'vscode-uri';
import {
	CompletionItem,
	CompletionItemKind,
	RemoteWorkspace,
	Hover,
	Location,
	Definition,
	SymbolInformation,
	Connection,
	Position
} from 'vscode-languageserver';

import { UCSymbol, UCReferenceSymbol, UCPackage, UCStructSymbol, UCClassSymbol, CORE_PACKAGE } from './symbols';
import { UCDocumentListener } from "./DocumentListener";

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
	for (let folder of folders) {
		const folderPath = URI.parse(folder.uri).fsPath;
		await scanPath(folderPath, (filePath => {
			filePaths.set(path.basename(filePath, '.uc').toLowerCase(), filePath);
		}));
	}
	return filePaths;
}

const WorkspaceClassesMap$ = new BehaviorSubject(new Map<string, string>());
let ClassCompletionItems: CompletionItem[] = [];

WorkspaceClassesMap$.subscribe(classesMap => {
	ClassCompletionItems = Array.from(classesMap.values())
		.map(value => {
			return {
				label: path.basename(value, '.uc'),
				kind: CompletionItemKind.Class
			};
		});
});

export async function initWorkspace(connection: Connection) {
	const UCFilePaths = await buildClassesFilePathsMap(connection.workspace);
	WorkspaceClassesMap$.next(UCFilePaths);
}

const SymbolsTable = new UCPackage('Workspace');
SymbolsTable.addSymbol(CORE_PACKAGE);

function findUriForQualifiedId(qualifiedClassId: string): string | undefined {
	const filePath: string = WorkspaceClassesMap$.value.get(qualifiedClassId);
	if (!filePath) {
		return undefined;
	}

	// FIXME: may not exist
	if (!fs.existsSync(filePath)) {
		return undefined;
	}

	const uriFromFilePath = URI.file(filePath).toString();
	return uriFromFilePath;
}

const Documents: Map<string, UCDocumentListener> = new Map<string, UCDocumentListener>();

export function getDocumentListenerById(qualifiedClassId: string, callback: (document: UCDocumentListener) => void) {
	console.log('Looking for external document ' + qualifiedClassId);

	// Try the shorter route first before we scan the entire workspace!
	if (SymbolsTable) {
		let classSymbol = SymbolsTable.findQualifiedSymbol(qualifiedClassId, true);
		if (classSymbol && classSymbol instanceof UCClassSymbol) {
			callback(classSymbol.document);
			return;
		}
	}

	const uri = findUriForQualifiedId(qualifiedClassId);
	if (!uri) {
		callback(undefined);
		return;
	}

	const document: UCDocumentListener = getDocumentListenerByUri(uri);
	// TODO: Parse and link created document.
	callback(document);
}

export function getDocumentListenerByUri(uri: string): UCDocumentListener {
	let document: UCDocumentListener = Documents.get(uri);
	if (document) {
		return document;
	}

	document = new UCDocumentListener(SymbolsTable, uri);
	document.getDocument = getDocumentListenerById;
	Documents.set(uri, document);
	return document;
}

export async function getHover(uri: string, position: Position): Promise<Hover> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbol = document.class.getSymbolAtPos(position);
	if (!symbol) {
		return undefined;
	}

	return {
		contents: symbol.getTooltip(),
		range: symbol.getIdRange()
	};
}

export async function getDefinition(uri: string, position: Position): Promise<Definition> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbol = document.class.getSymbolAtPos(position);
	if (!symbol || !(symbol instanceof UCReferenceSymbol)) {
		return undefined;
	}

	const reference = symbol.getReference();
	if (!(reference instanceof UCSymbol)) {
		return undefined;
	}
	return Location.create(reference.getUri(), reference.getIdRange());
}

export async function getSymbols(uri: string): Promise<SymbolInformation[]> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	var contextSymbols = [];
	var buildSymbolsList = (container: UCStructSymbol) => {
		for (let child = container.children; child; child = child.next) {
			contextSymbols.push(child.toSymbolInfo());
			if (child instanceof UCStructSymbol) {
				buildSymbolsList(child as UCStructSymbol);
			}
		}
	};

	buildSymbolsList(document.class);
	return contextSymbols;
}

export async function getReferences(uri: string, position: Position): Promise<Location[]> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbol = document.class.getSymbolAtPos(position);
	if (!symbol) {
		return undefined;
	}
	return symbol.getReferencedLocations();
}

export async function getCompletionItems(uri: string, position: Position): Promise<CompletionItem[]> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbols = document.class.getContextSymbolsAtPos(position);
	if (!symbols) {
		return undefined;
	}
	return [].concat(symbols.map(symbol => symbol.toCompletionItem()), ClassCompletionItems);
}