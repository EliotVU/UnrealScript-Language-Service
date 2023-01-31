import { DocumentSymbol, DocumentUri, SymbolKind } from 'vscode-languageserver';

import { getSymbolDetail } from './documentSymbolDetailBuilder';
import { getSymbolTags } from './documentSymbolTagsBuilder';
import { getDocumentByURI } from './UC/indexer';
import { hasModifiers, isClass, isStruct, ModifierFlags, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './UC/Symbols';

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

export function isDocumentSymbol(symbol: UCObjectSymbol) {
    // Exclude generated symbols
    if (hasModifiers(symbol) && (symbol.modifiers & ModifierFlags.Generated) != 0) {
        return false;
    }
    return true;
}

export function getDocumentSymbols(uri: DocumentUri): DocumentSymbol[] | undefined {
    const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const documentSymbols: DocumentSymbol[] = [];

    // Little hack, lend a hand and push all the class's children to the top.
    const symbols = document.enumerateSymbols();
    for (let symbol of symbols) {
        if (isDocumentSymbol(symbol)) {
            const documentSymbol = toDocumentSymbol(symbol);
            documentSymbols.push(documentSymbol);
            // Special case for UnrealScript's weird class declaration. 
            // The range of a class does not encapsulate its children, so we'll insert these independently.
            if (isClass(symbol) && documentSymbol.children) {
                documentSymbols.push(...documentSymbol.children);
                delete documentSymbol.children;
            }
        }
    }

    return documentSymbols;

    function buildDocumentSymbols(container: UCStructSymbol, symbols: DocumentSymbol[]) {
        for (let child = container.children; child; child = child.next) {
            if (isDocumentSymbol(child)) {
                symbols.push(toDocumentSymbol(child));
            }
        }
    }

    function toDocumentSymbol(symbol: UCObjectSymbol): DocumentSymbol {
        let children: DocumentSymbol[] | undefined;
        if (isStruct(symbol)) {
            children = [];
            buildDocumentSymbols(symbol, children);
        }

        const symbolRange = symbol.getRange();
        const selectionRange = symbol.id.range;

        const documentSymbol: DocumentSymbol = {
            name: symbol.id.name.text,
            detail: getSymbolDetail(symbol),
            kind: SymbolKindMap.get(symbol.kind) ?? SymbolKind.Null,
            tags: getSymbolTags(symbol),
            range: symbolRange,
            selectionRange: selectionRange,
            children,
        };
        return documentSymbol;
    }
}

