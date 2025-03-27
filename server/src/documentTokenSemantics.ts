import { Range } from 'vscode-languageserver-textdocument';
import { SemanticTokens } from 'vscode-languageserver/node';

import { UCDocument } from './UC/document';
import { DocumentSemanticsBuilder } from './UC/documentSemanticsBuilder';

export async function getDocumentSemanticTokens(
    document: UCDocument,
    range?: Range
): Promise<SemanticTokens> {
    const walker = new DocumentSemanticsBuilder(range);
    const tokens = walker.visitDocument(document);
    return tokens;
}
