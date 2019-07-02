import {
	CompletionItem,
	Hover,
	Location,
	SymbolInformation,
	Position,
	Range,
	DocumentHighlight,
	DocumentHighlightKind,
	CompletionContext
} from 'vscode-languageserver';
import { Token } from 'antlr4ts';

import { IWithReference, ISymbol, UCSymbol, UCSymbolReference, UCStructSymbol, SymbolsTable, UCFieldSymbol } from './Symbols';
import { getDocumentByUri, getIndexedReferences } from "./indexer";

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

export function intersectsWithRange(position: Position, range: Range): boolean {
	return position.line >= range.start.line && position.line <= range.end.line
		&& position.character >= range.start.character && position.character < range.end.character;
}

export async function getHover(uri: string, position: Position): Promise<Hover | undefined> {
	const document = getDocumentByUri(uri);
	const ref = document && document.getSymbolAtPos(position);
	if (!ref) {
		return undefined;
	}

	if (ref instanceof UCSymbol) {
		const contents = [{ language: 'unrealscript', value: ref.getTooltip()}];

		const documentation = ref.getDocumentation(document.tokenStream);
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
	const document = getDocumentByUri(uri);
	const ref = document && document.getSymbolAtPos(position) as unknown as IWithReference;
	if (!ref) {
		return undefined;
	}

	const symbol = ref.getReference && ref.getReference();
	if (symbol instanceof UCSymbol) {
		return symbol;
	}
	return ref;
}

export async function getSymbol(uri: string, position: Position): Promise<ISymbol | undefined> {
	const document = getDocumentByUri(uri);
	return document && document.getSymbolAtPos(position);
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

export async function getCompletionItems(uri: string, position: Position): Promise<CompletionItem[] | undefined> {
	const document = getDocumentByUri(uri);
	if (!document || !document.class) {
		return undefined;
	}

	const contextSymbol = document.class.getCompletionContext(position);
	if (!contextSymbol) {
		return undefined;
	}

	let selectedSymbol: ISymbol = contextSymbol;
	if (contextSymbol && (<IWithReference>contextSymbol).getReference) {
		const resolvedSymbol = (<IWithReference>contextSymbol).getReference();
		if (resolvedSymbol instanceof UCSymbol) {
			selectedSymbol = resolvedSymbol;
		}
	}

	if (selectedSymbol instanceof UCSymbol) {
		const symbols = selectedSymbol.getCompletionSymbols(document);
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