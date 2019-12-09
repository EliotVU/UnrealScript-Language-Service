import {
	CompletionItem,
	Hover,
	Location,
	SymbolInformation,
	Position,
	Range,
	DocumentHighlight,
	DocumentHighlightKind
} from 'vscode-languageserver';
import { Token, ParserRuleContext } from 'antlr4ts';

import { TokenExt } from './Parser/CommonTokenStreamExt';
import { IWithReference, ISymbol, UCSymbol, UCStructSymbol, tryFindClassSymbol } from './Symbols';
import { getDocumentByURI, getIndexedReferences } from "./indexer";
import { UCDocument } from './document';

export function rangeFromBound(token: Token): Range {
	const length = (token as TokenExt).length;
	const line = token.line - 1;
	const start: Position = {
		line,
		character: token.charPositionInLine
	};
	const end: Position = {
		line,
		character: token.charPositionInLine + length
	};
	return { start, end };
}

export function rangeFromBounds(startToken: Token, stopToken: Token = startToken): Range {
	const length = (stopToken as TokenExt).length;
	const start: Position = {
		line: startToken.line - 1,
		character: startToken.charPositionInLine
	};
	const end: Position = {
		line: stopToken.line - 1,
		character: stopToken.charPositionInLine + length
	};
	return { start, end };
}

export function rangeFromCtx(ctx: ParserRuleContext): Range {
	const length = (ctx.stop as TokenExt).length;
	const start = {
		line: ctx.start.line - 1,
		character: ctx.start.charPositionInLine
	};
	const end: Position = {
		line: ctx.stop!.line - 1,
		character: ctx.stop!.charPositionInLine + length
	};
	return { start, end };
}

export function intersectsWith(range: Range, position: Position): boolean {
	if (position.line < range.start.line || position.line > range.end.line) {
		return false;
	}

	if (range.start.line === range.end.line) {
		return position.character >= range.start.character && position.character < range.end.character;
	}

	if (position.line === range.start.line) {
		return position.character >= range.start.character;
	}

	if (position.line === range.end.line) {
		return position.character <= range.end.character;
	}
	return true;
}

export function intersectsWithRange(position: Position, range: Range): boolean {
	return position.line >= range.start.line
		&& position.line <= range.end.line
		&& position.character >= range.start.character
		&& position.character < range.end.character;
}

function getDocumentSymbol(document: UCDocument, position: Position): ISymbol | undefined {
	const symbols = document.getSymbols();
	for (let symbol of symbols) {
		const child = symbol.getSymbolAtPos(position);
		if (child) {
			return child;
		}
	}
	return undefined;
}

function getDocumentCompletionContext(document: UCDocument, position: Position): ISymbol | undefined {
	const symbols = document.getSymbols();
	for (let symbol of symbols) {
		if (symbol instanceof UCStructSymbol) {
			const child = symbol.getCompletionContext(position);
			if (child) {
				return child;
			}
		}
	}
	return undefined;
}

export async function getSymbolTooltip(uri: string, position: Position): Promise<Hover | undefined> {
	const document = getDocumentByURI(uri);
	const ref = document && getDocumentSymbol(document, position);
	if (ref && ref instanceof UCSymbol) {
		const contents = [{ language: 'unrealscript', value: ref.getTooltip() }];

		const documentation = ref.getDocumentation();
		if (documentation) {
			contents.push({ language: 'unrealscript', value: documentation });
		}

		return {
			contents,
			range: ref.id.range
		};
	}
}

export async function getSymbolDefinition(uri: string, position: Position): Promise<ISymbol | undefined> {
	const document = getDocumentByURI(uri);
	const ref = document && getDocumentSymbol(document, position) as unknown as IWithReference;
	if (!ref) {
		return undefined;
	}

	const symbol = ref.getRef?.();
	if (symbol instanceof UCSymbol) {
		return symbol;
	}
	return ref;
}

export async function getSymbol(uri: string, position: Position): Promise<ISymbol | undefined> {
	const document = getDocumentByURI(uri);
	return document && getDocumentSymbol(document, position);
}

export async function getSymbols(uri: string): Promise<SymbolInformation[] | undefined> {
	const document = getDocumentByURI(uri);
	if (!document) {
		return undefined;
	}

	const contextSymbols: SymbolInformation[] = document.getSymbols().map(s => s.toSymbolInfo());
	const buildSymbolsList = (container: UCStructSymbol) => {
		for (let child = container.children; child; child = child.next) {
			contextSymbols.push(child.toSymbolInfo());
			if (child instanceof UCStructSymbol) {
				buildSymbolsList(child as UCStructSymbol);
			}
		}
	};

	for (let symbol of contextSymbols) {
		if (symbol instanceof UCStructSymbol) {
			buildSymbolsList(symbol);
		}
	}
	return contextSymbols;
}

export async function getSymbolReferences(uri: string, position: Position): Promise<Location[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!symbol) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getHash());
	if (!references) {
		return undefined;
	}
	return Array.from(references.values())
		.map(ref => ref.location);
}

export async function getSymbolHighlights(uri: string, position: Position): Promise<DocumentHighlight[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!symbol) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getHash());
	if (!references) {
		return undefined;
	}

	return Array
		.from(references.values())
		.filter(loc => loc.location.uri === uri)
		.map(ref => DocumentHighlight.create(
			ref.location.range,
			ref.inAssignment
				? DocumentHighlightKind.Write
				: DocumentHighlightKind.Read
		));
}

export async function getCompletableSymbolItems(uri: string, position: Position, context: string): Promise<CompletionItem[] | undefined> {
	const document = getDocumentByURI(uri);
	if (!document) {
		return undefined;
	}

	const contextSymbol = getDocumentCompletionContext(document, position);
	if (!contextSymbol) {
		return undefined;
	}

	let symbols: ISymbol[] = [];
	if (contextSymbol instanceof UCSymbol) {
		const symbol = contextSymbol instanceof UCStructSymbol
			&& contextSymbol.block
			&& contextSymbol.block.getSymbolAtPos(position);

		if (context === '.' && symbol && (<IWithReference>symbol).getRef) {
			const resolvedSymbol = (<IWithReference>symbol).getRef();
			if (resolvedSymbol instanceof UCSymbol) {
				symbols = resolvedSymbol.getCompletionSymbols(document, context);
			}
		} else {
			symbols = contextSymbol.getCompletionSymbols(document, context);
		}
	}

	const contextCompletions = symbols.map(symbol => symbolToCompletionItem(symbol));
	return contextCompletions;
}

function symbolToCompletionItem(symbol: ISymbol): CompletionItem {
	if (symbol instanceof UCSymbol) {
		return {
			label: symbol.getName().toString(),
			kind: symbol.getCompletionItemKind(),
			detail: symbol.getTooltip(),
			documentation: symbol.getDocumentation(),
			data: symbol.getPath()
		};
	}

	return {
		label: symbol.getName().toString()
	};
}

export async function getFullCompletionItem(item: CompletionItem): Promise<CompletionItem> {
	if (item.data) {
		const symbol = tryFindClassSymbol(item.data);
		if (!symbol) {
			return item;
		}
		item.documentation = symbol.getDocumentation();
	}
	return item;
}