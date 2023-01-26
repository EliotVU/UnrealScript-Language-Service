import { CodeAction, Range } from 'vscode-languageserver';

import { DocumentCodeActionsBuilder } from './UC/documentCodeActionsBuilder';
import { getDocumentSymbol } from './UC/helpers';
import { getDocumentByURI } from './UC/indexer';

export async function buildCodeActions(uri: string, range: Range): Promise<CodeAction[] | undefined> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const position = range.start;
    const symbol = getDocumentSymbol(document, position);
    if (symbol) {
        const builder = new DocumentCodeActionsBuilder(document);
        symbol.accept(builder);
        return builder.codeActions;
    }
    return undefined;
}
