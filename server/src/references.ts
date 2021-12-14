import { Location, Position } from 'vscode-languageserver';

import { getSymbolDefinition } from './UC/helpers';
import { getIndexedReferences } from './UC/indexer';

export async function getReferences(uri: string, position: Position): Promise<Location[] | undefined> {
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
