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
	CompletionContext
} from 'vscode-languageserver';

import { UCSymbol, UCSymbolReference, UCStructSymbol, SymbolsTable, UCFieldSymbol } from './Symbols';
import { getDocumentByUri, ClassNameToFilePathMap$, getIndexedReferences } from "./DocumentListener";
import { Token } from 'antlr4ts';
import { IWithReference, ISymbol } from './Symbols/ISymbol';

export function rangeFromBound(token: Token): Range {
	const length = token.text!.length;

	const start: Position = {
		line: token.line - 1,
		character: token.charPositionInLine
	};

	const end: Position = {
		line: token.line - 1,
		character: token.charPositionInLine + length
	};
	return { start, end };
}

export function rangeFromBounds(startToken: Token, stopToken: Token = startToken): Range {
	const length = stopToken.text!.length;

	return {
		start: {
			line: startToken.line - 1,
			character: startToken.charPositionInLine
		},
		end: {
			line: stopToken.line - 1,
			character: stopToken.charPositionInLine + length
		}
	};
}

export function intersectsWith(range: Range, position: Position): boolean {
	if (position.line < range.start.line || position.line > range.end.line) {
		return false;
	}

	if (range.start.line === range.end.line) {
		return position.character >= range.start.character && position.character < range.end.character;
	}

	if (position.line == range.start.line) {
		return position.character >= range.start.character;
	}

	if (position.line == range.end.line) {
		return position.character <= range.end.character;
	}
	return true;
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

export async function initWorkspace(connection: Connection) {
	const filePathMap = await buildClassesFilePathsMap(connection.workspace);
	ClassNameToFilePathMap$.next(filePathMap);
}

export async function getHover(uri: string, position: Position): Promise<Hover | undefined> {
	const document = getDocumentByUri(uri);
	const symbol = document && document.getSymbolAtPos(position);
	if (!symbol) {
		return undefined;
	}

	if (symbol instanceof UCSymbol) {
		const contents = [{ language: 'unrealscript', value: symbol.getTooltip()}];

		const documentation = symbol.getDocumentation(document.tokenStream);
		if (documentation) {
			contents.push({ language: 'unrealscript', value: documentation });
		}

		return {
			contents,
			range: symbol.getNameRange()
		};
	}
}

export async function getDefinition(uri: string, position: Position): Promise<Definition | undefined> {
	const document = getDocumentByUri(uri);
	const symbol = document && document.getSymbolAtPos(position) as unknown as IWithReference;
	if (!symbol) {
		return undefined;
	}

	const reference = symbol.getReference && symbol.getReference();
	if (reference instanceof UCSymbol) {
		const uri = reference.getUri();
		// This shouldn't happen, except for non UCSymbol objects.
		if (!uri) {
			console.warn('No uri for referred symbol', reference);
			return undefined;
		}
		return Location.create(uri, reference.getNameRange());
	}
	return undefined;
}

export async function getSymbols(uri: string): Promise<SymbolInformation[] | undefined> {
	const document = getDocumentByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const contextSymbols: SymbolInformation[] = [];
	const buildSymbolsList = (container: UCStructSymbol) => {
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

export async function getReferences(uri: string, position: Position): Promise<Location[] | undefined> {
	const document = getDocumentByUri(uri);
	const symbol = document && document.getSymbolAtPos(position) as ISymbol;
	if (!symbol) {
		return undefined;
	}

	const symbolWithReference = symbol as IWithReference;
	const reference = symbolWithReference.getReference && symbolWithReference.getReference();

	const qualifiedName = reference
		? reference.getQualifiedName()
		: symbol.getQualifiedName();
	const references = getIndexedReferences(qualifiedName);
	return references && Array
		.from(references.values())
		.map(ref => ref.location);
}

export async function getHighlights(uri: string, position: Position): Promise<DocumentHighlight[] | undefined> {
	const document = getDocumentByUri(uri);
	const symbol = document && document.getSymbolAtPos(position);
	if (!symbol) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getQualifiedName());
	if (!references) {
		return undefined;
	}

	return Array
		.from(references.values())
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

export async function getCompletionItems(uri: string, position: Position, context: CompletionContext | undefined): Promise<CompletionItem[] | undefined> {
	const document = getDocumentByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	-- position.character;
	// Temp workaround for context expressions that haven't yet been parsed as such.
	if (context && context.triggerCharacter === '.') {
		-- position.character;
	}

	let symbol = document.class.getCompletionContext(position);
	if (symbol && symbol instanceof UCSymbolReference) {
		symbol = symbol.getReference() as UCSymbol;
	}

	if (!symbol) {
		return undefined;
	}

	if (symbol instanceof UCFieldSymbol) {
		const symbols = symbol.getCompletionSymbols(document);
		const contextCompletions = symbols.map(symbol => symbol.toCompletionItem(document));
		// TODO: Add context sensitive keywords
		return contextCompletions;
	}
}

export async function getFullCompletionItem(item: CompletionItem): Promise<CompletionItem> {
	if (item.data) {
		const symbol = SymbolsTable.findSymbol(item.data, true) as UCSymbol;
		if (!symbol) {
			return item;
		}

		const uri = symbol.getUri();
		if (!uri) {
			console.warn("no uri for symbol", symbol);
			return item;
		}

		const tokenStream = getDocumentByUri(uri).tokenStream;
		item.documentation = symbol.getDocumentation(tokenStream);
	}
	return item;
}