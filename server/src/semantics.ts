import { SemanticTokens } from 'vscode-languageserver/node';

import { UCDocument } from './UC/document';
import { DocumentSemanticsBuilder } from './UC/documentSemanticsBuilder';

export async function buildSemanticTokens(document: UCDocument): Promise<SemanticTokens> {
    const walker = new DocumentSemanticsBuilder(document);
    document.accept(walker);

    return walker.getTokens();
}