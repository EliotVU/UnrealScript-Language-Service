import * as path from 'path';
import * as fs from 'fs';

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
	Position,
	Range,
	DocumentHighlight,
	DocumentHighlightKind,
	MarkedString
} from 'vscode-languageserver';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol, UCScriptStructSymbol } from './symbols';
import { getDocumentListenerByUri, ClassesMap$ } from "./DocumentListener";
import { Token } from 'antlr4ts';

export function rangeFromBound(token: Token): Range {
	const start: Position = {
		line: token.line - 1,
		character: token.charPositionInLine
	};

	const end: Position = {
		line: token.line - 1,
		character: token.charPositionInLine + token.text.length
	};
	return { start, end };
}

export function rangeFromBounds(startToken: Token, stopToken: Token): Range {
	return {
		start: {
			line: startToken.line - 1,
			character: startToken.charPositionInLine
		},
		end: {
			line: stopToken.line - 1,
			character: stopToken.charPositionInLine + stopToken.text.length
		}
	};
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
	for (let folder of folders) {
		const folderPath = URI.parse(folder.uri).fsPath;
		await scanPath(folderPath, (filePath => {
			filePaths.set(path.basename(filePath, '.uc').toLowerCase(), filePath);
		}));
	}
	return filePaths;
}

let ClassCompletionItems: CompletionItem[] = [];

ClassesMap$.subscribe(classesMap => {
	ClassCompletionItems = Array.from(classesMap.values())
		.map(value => {
			return {
				label: path.basename(value, '.uc'),
				kind: CompletionItemKind.Class
			};
		});
});

export async function initWorkspace(connection: Connection) {
	const filePathMap = await buildClassesFilePathsMap(connection.workspace);
	ClassesMap$.next(filePathMap);
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

	let contents = [{ language: 'unrealscript', value: symbol.getTooltip()}];

	const documentation = symbol.getDocumentation(document.tokenStream);
	if (documentation) {
		contents.push({ language: 'unrealscript', value: documentation });
	}

	return {
		contents,
		range: symbol.getNameRange()
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
	return Location.create(reference.getUri(), reference.getNameRange());
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
	return Array
		.from(symbol.getReferences().values())
		.map(ref => ref.location);
}

export async function getHighlights(uri: string, position: Position): Promise<DocumentHighlight[]> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbol = document.class.getSymbolAtPos(position);
	if (!symbol) {
		return undefined;
	}

	const refs = symbol.getReferences();
	if (!refs) {
		return undefined;
	}

	return Array
		.from(refs.values())
		.filter(loc => loc.location.uri === uri)
		.map(ref => DocumentHighlight.create(
			ref.location.range,
			ref.context
				? ref.context.inAssignment
					? DocumentHighlightKind.Write
					: DocumentHighlightKind.Read
				: undefined
		));
}

export async function getCompletionItems(uri: string, position: Position): Promise<CompletionItem[]> {
	const document = getDocumentListenerByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const context = document.class.getContextSymbolAtPos(position);
	if (!context) {
		return undefined;
	}

	const symbols = context.getCompletionSymbols();
	let contextCompletions = symbols.map(symbol => symbol.toCompletionItem(document));

	// if (!(context instanceof UCScriptStructSymbol)) {
	// 	contextCompletions = contextCompletions.concat(ClassCompletionItems);
	// }
	return contextCompletions;
}