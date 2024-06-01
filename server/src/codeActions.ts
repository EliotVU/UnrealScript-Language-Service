import { CodeAction, Range } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';

import { ISymbol } from './UC/Symbols';
import { UCDocument } from './UC/document';
import { DocumentCodeActionsBuilder } from './documentCodeActionsBuilder';
import { getDocumentSymbol } from './UC/helpers';
import { getDocumentByURI } from './UC/indexer';

export async function getDocumentCodeActions(uri: DocumentUri, range: Range): Promise<CodeAction[] | undefined> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const position = range.start;
    const symbol = getDocumentSymbol(document, position);
    if (symbol) {
        return getSymbolDocumentCodeActions(document, symbol);
    }

    return undefined;
}

export function getSymbolDocumentCodeActions(document: UCDocument, symbol: ISymbol): CodeAction[] | undefined {
    const builder = new DocumentCodeActionsBuilder(document);
    symbol.accept(builder);
    return builder.codeActions;
}
