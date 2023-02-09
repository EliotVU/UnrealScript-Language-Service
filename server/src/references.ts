import { Location, Position } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';

import { getSymbolDefinition } from './UC/helpers';
import { getIndexedReferences } from './UC/indexer';
import { ISymbol } from './UC/Symbols';

export async function getReferences(uri: DocumentUri, position: Position): Promise<Location[] | undefined> {
    const symbol = getSymbolDefinition(uri, position);
    if (!symbol) {
        return undefined;
    }

    return getSymbolReferences(symbol);
}

export function getSymbolReferences(symbol: ISymbol): Location[] | undefined {
    const references = getIndexedReferences(symbol.getHash());
    if (!references) {
        return undefined;
    }
    
    return Array.from(references.values())
        .map(ref => ref.location);
}
