import { SemanticTokens } from 'vscode-languageserver/node';

import { DocumentSemanticsBuilder } from './UC/documentSemanticsBuilder';
import { getDocumentByURI } from './UC/indexer';

export async function buildSemanticTokens(uri: string): Promise<SemanticTokens> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return {
            data: []
        };
    }

    const walker = new DocumentSemanticsBuilder(document);
    document.accept(walker);

    return walker.getTokens();
}