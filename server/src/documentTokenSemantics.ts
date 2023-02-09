import { SemanticTokens } from 'vscode-languageserver/node';

import { UCDocument } from './UC/document';
import { DocumentSemanticsBuilder } from './UC/documentSemanticsBuilder';

export async function getDocumentSemanticTokens(document: UCDocument): Promise<SemanticTokens> {
    const walker = new DocumentSemanticsBuilder();
    const tokens = walker.visitDocument(document);
    return tokens;
}