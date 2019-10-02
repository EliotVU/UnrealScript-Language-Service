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
import { IWithReference, ISymbol, UCSymbol, UCStructSymbol, ClassesTable } from './Symbols';
import { getDocumentByUri, getIndexedReferences } from "./indexer";

export function rangeFromBound(token: Token): Range {
	const length = (token as TokenExt).length;

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
	const length = (stopToken as TokenExt).length;

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

export function rangeFromCtx(ctx: ParserRuleContext): Range {
	const length = (ctx.stop as TokenExt).length;
	const start = {
		line: ctx.start.line - 1,
		character: ctx.start.charPositionInLine
	};
	return {
		start,
		end: ctx.stop ? {
			line: ctx.stop.line - 1,
			character: ctx.stop.charPositionInLine + length
		} : start
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

export async function getSymbolTooltip(uri: string, position: Position): Promise<Hover | undefined> {
	const document = getDocumentByUri(uri);
	const ref = document && document.getSymbolAtPos(position);
	if (!ref) {
		return undefined;
	}

	if (ref instanceof UCSymbol) {
		const contents = [{ language: 'unrealscript', value: ref.getTooltip()}];

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

export async function getSymbolReferences(uri: string, position: Position): Promise<Location[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!(symbol instanceof UCSymbol)) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getQualifiedName());
	return references && Array
		.from(references.values())
		.map(ref => ref.location);
}

export async function getSymbolHighlights(uri: string, position: Position): Promise<DocumentHighlight[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!(symbol instanceof UCSymbol)) {
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

export async function getSymbolItems(uri: string, position: Position): Promise<CompletionItem[] | undefined> {
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
		const symbol = ClassesTable.findSymbol(item.data, true) as UCSymbol;
		if (!symbol) {
			return item;
		}

		const uri = symbol.getUri();
		if (!uri) {
			console.warn("no uri for symbol", symbol);
			return item;
		}
		item.documentation = symbol.getDocumentation();
	}
	return item;
}