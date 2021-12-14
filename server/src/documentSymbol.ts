import { SymbolInformation } from 'vscode-languageserver';

import { getDocumentByURI } from './UC/indexer';
import { UCStructSymbol } from './UC/Symbols';

export async function getSymbols(uri: string): Promise<SymbolInformation[] | undefined> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const contextSymbols: SymbolInformation[] = document.getSymbols().map(s => s.toSymbolInfo());
    const buildSymbolsList = (container: UCStructSymbol) => {
        for (let child = container.children; child; child = child.next) {
            contextSymbols.push(child.toSymbolInfo());
            if (child instanceof UCStructSymbol) {
                buildSymbolsList(child as UCStructSymbol);
            }
        }
    };

    for (const symbol of contextSymbols) {
        if (symbol instanceof UCStructSymbol) {
            buildSymbolsList(symbol);
        }
    }
    return contextSymbols;
}
