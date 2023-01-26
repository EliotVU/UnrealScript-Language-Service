import { DocumentHighlight, DocumentHighlightKind, Position } from 'vscode-languageserver';

import { getSymbolDefinition } from './UC/helpers';
import { getIndexedReferences } from './UC/indexer';

export async function getHighlights(uri: string, position: Position): Promise<DocumentHighlight[] | undefined> {
    const symbol = getSymbolDefinition(uri, position);
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
