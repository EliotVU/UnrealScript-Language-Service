import { Location, LocationLink, type Definition, type DefinitionLink, type Position } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import type { UCDocument } from './UC/document';
import { getDocumentSymbol, getSymbolDocument, resolveSymbolToRef } from './UC/helpers';
import { DEFAULT_RANGE, isPackage, type ISymbol } from './UC/Symbols';

/**
 * Returns a `Location` that represents the definition at a given position within the document.
 *
 * If a symbol is found at the position, then the symbol's definition location will be returned instead.
 **/
export async function getDocumentDefinition(
    document: UCDocument,
    position: Position
): Promise<Definition | DefinitionLink[] | undefined> {
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
): Definition | DefinitionLink[] | undefined {
    const symbolRef = resolveSymbolToRef(symbol);
    if (!symbolRef) {
        return undefined;
    }

    if (isPackage(symbolRef) && typeof symbolRef.filePath === 'string') {
        const uri = URI.file(symbolRef.filePath).toString();
        return [LocationLink.create(uri, DEFAULT_RANGE, DEFAULT_RANGE)];
    }

    const externalDocument = getSymbolDocument(symbolRef);
    return externalDocument?.uri
        ? Location.create(externalDocument.uri, symbolRef.id.range)
        : undefined;
}
