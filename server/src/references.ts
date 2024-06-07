import { Location, Position, ReferenceContext } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';

import { getSymbolDefinition } from './UC/helpers';
import { getIndexedReferences } from './UC/indexer';
import { ISymbol, SymbolReferenceFlags } from './UC/Symbols';

export async function getReferences(uri: DocumentUri, position: Position, context: ReferenceContext): Promise<Location[] | undefined> {
    const symbol = getSymbolDefinition(uri, position);
    if (!symbol) {
        return undefined;
    }

    let filterFlags = SymbolReferenceFlags.All;
    if (!context.includeDeclaration) {
        filterFlags &= ~SymbolReferenceFlags.Declaration;
    }

    return getSymbolReferences(symbol, filterFlags);
}

export function getSymbolReferences(symbol: ISymbol, flags: SymbolReferenceFlags = SymbolReferenceFlags.All): Location[] | undefined {
    const references = getIndexedReferences(symbol.getHash());
    if (!references) {
        return undefined;
    }

    const locations: Location[] = [];
    for (const ref of references) {
        if (ref.flags && (ref.flags & flags) === 0) {
            continue;
        }

        locations.push(ref.location);
    }

    return locations;
}
