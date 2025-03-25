import { type Position, Location } from 'vscode-languageserver';
import type { UCDocument } from './UC/document';
import { getDocumentSymbol, getSymbolDocument, resolveSymbolToRef } from './UC/helpers';
import type { ISymbol } from './UC/Symbols';

/**
 * Returns a `Location` that represents the definition at a given position within the document.
 *
 * If a symbol is found at the position, then the symbol's definition location will be returned instead.
 **/
export async function getDocumentDefinition(
    document: UCDocument,
    position: Position
): Promise<Location | undefined> {
    const symbol = getDocumentSymbol(document, position);
    if (!symbol) {
        return undefined;
    }

    return getSymbolDocumentDefinition(document, symbol);
}

/**
 * Returns a `Location` that represents the definition of a symbol.
 **/
export function getSymbolDocumentDefinition(
    document: UCDocument, // placeholder
    symbol: ISymbol
): Location | undefined {
    const symbolRef = resolveSymbolToRef(symbol);
    if (!symbolRef) {
        return undefined;
    }

    const externalDocument = getSymbolDocument(symbolRef);
    return externalDocument?.uri
        ? Location.create(externalDocument.uri, symbolRef.id.range)
        : undefined;
}
