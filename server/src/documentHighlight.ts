import { DocumentHighlight, DocumentHighlightKind, Position } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';

import { UCDocument } from './UC/document';
import { getDocumentSymbol, resolveSymbolToRef } from './UC/helpers';
import { getDocumentByURI } from './UC/indexer';
import { ISymbol, SymbolReference, SymbolReferenceFlags } from './UC/Symbols';

export async function getDocumentHighlights(
    uri: DocumentUri,
    position: Position
): Promise<DocumentHighlight[] | undefined> {
    const document = getDocumentByURI(uri);
    const symbol = document && getDocumentSymbol(document, position);
    if (!symbol) {
        return undefined;
    }

    const symbolRef = resolveSymbolToRef(symbol);
    if (!symbolRef) {
        return undefined;
    }

    return getSymbolDocumentHighlights(document, symbolRef);
}

export function getSymbolDocumentHighlights(
    document: UCDocument,
    symbol: ISymbol
): DocumentHighlight[] | undefined {
    const references = document.getReferencesToSymbol(symbol);
    if (!references) {
        return undefined;
    }

    return Array
        .from(references.values())
        .map(toDocumentHighlight);

    function toDocumentHighlight(ref: SymbolReference): DocumentHighlight {
        return DocumentHighlight.create(
            ref.location.range,
            (ref.flags & (SymbolReferenceFlags.Assignment | SymbolReferenceFlags.Declaration))
                ? DocumentHighlightKind.Write
                : DocumentHighlightKind.Read
        );
    }
}
