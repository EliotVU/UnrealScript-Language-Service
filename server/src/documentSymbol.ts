import { DocumentSymbol, DocumentUri, SymbolKind } from 'vscode-languageserver';

import { getSymbolDetail } from './documentSymbolDetailBuilder';
import { getSymbolTags } from './documentSymbolTagsBuilder';
import { getDocumentByURI } from './UC/indexer';
import { isClass, isStruct, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './UC/Symbols';

export const SymbolKindMap = new Map<UCSymbolKind, SymbolKind>([
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
 
export function getDocumentSymbols(uri: DocumentUri): DocumentSymbol[] | undefined {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const documentSymbols: DocumentSymbol[] = [];

    // Little hack, lend a hand and push all the class's children to the top.
    const symbols = document.getSymbols();
    for (let symbol of symbols) {
        if (isClass(symbol)) {
            for (let child = symbol.children; child != null; child = child.next) {
                documentSymbols.unshift(toDocumentSymbol(child));
            }
            documentSymbols.unshift(toDocumentSymbol(symbol));
            continue;
        }

        documentSymbols.push(toDocumentSymbol(symbol));
    }

    return documentSymbols;

    function buildDocumentSymbols(container: UCStructSymbol, symbols: DocumentSymbol[]) {
        for (let child = container.children; child; child = child.next) {
            symbols.unshift(toDocumentSymbol(child));
        }
    }

    function toDocumentSymbol(symbol: UCObjectSymbol): DocumentSymbol {
        let children: DocumentSymbol[] | undefined;
        if (isStruct(symbol) && !isClass(symbol)) {
            children = [];
            buildDocumentSymbols(symbol, children);
        }

        const documentSymbol: DocumentSymbol = {
            name: symbol.id.name.text,
            detail: getSymbolDetail(symbol),
            kind: SymbolKindMap.get(symbol.kind) ?? SymbolKind.Null,
            tags: getSymbolTags(symbol),
            range: symbol.getRange(),
            selectionRange: symbol.id.range,
            children,
        };
        return documentSymbol;
    }
}

