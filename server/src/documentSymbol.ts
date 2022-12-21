import { SymbolInformation, SymbolKind } from 'vscode-languageserver';

import { getDocumentByURI } from './UC/indexer';
import { isStruct, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './UC/Symbols';

const SymbolKindMap = new Map<UCSymbolKind, SymbolKind>([
    [UCSymbolKind.Package, SymbolKind.Package],
    [UCSymbolKind.Archetype, SymbolKind.Object],
    [UCSymbolKind.ScriptStruct, SymbolKind.Struct],
    [UCSymbolKind.State, SymbolKind.Namespace],
    [UCSymbolKind.Class, SymbolKind.Class],
    [UCSymbolKind.Interface, SymbolKind.Interface],
    [UCSymbolKind.Const, SymbolKind.Constant],
    [UCSymbolKind.Enum, SymbolKind.Enum],
    [UCSymbolKind.EnumTag, SymbolKind.EnumMember],
    [UCSymbolKind.Property, SymbolKind.Property],
    [UCSymbolKind.Parameter, SymbolKind.Variable],
    [UCSymbolKind.Local, SymbolKind.Variable],
    [UCSymbolKind.Function, SymbolKind.Function],
    [UCSymbolKind.Event, SymbolKind.Event],
    [UCSymbolKind.Delegate, SymbolKind.Event],
    [UCSymbolKind.Operator, SymbolKind.Operator],
    [UCSymbolKind.ReplicationBlock, SymbolKind.Constructor],
    [UCSymbolKind.DefaultPropertiesBlock, SymbolKind.Constructor],
]);

function toSymbolInfo(symbol: UCObjectSymbol, uri: string): SymbolInformation {
    const kind = SymbolKindMap.get(symbol.kind) ?? SymbolKind.Null;
    return SymbolInformation.create(
        symbol.getName().text, kind,
        symbol.getRange(), uri,
        symbol.outer?.getName().text
    );
}

export async function getSymbols(uri: string): Promise<SymbolInformation[] | undefined> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const symbols = document.getSymbols();
    const contextSymbols: SymbolInformation[] = symbols
        .map(s => toSymbolInfo(s, uri));
    const buildSymbolsList = (container: UCStructSymbol) => {
        for (let child = container.children; child; child = child.next) {
            contextSymbols.push(toSymbolInfo(child, uri));
            if (isStruct(child)) {
                buildSymbolsList(child);
            }
        }
    };

    for (const symbol of symbols) {
        if (isStruct(symbol)) {
            buildSymbolsList(symbol);
        }
    }
    return contextSymbols;
}
