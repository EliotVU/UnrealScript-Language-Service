import { SymbolKind, WorkspaceSymbol } from 'vscode-languageserver';

import { SymbolKindMap } from './documentSymbol';
import { getSymbolTags } from './UC/documentSymbolTagsBuilder';
import { isSymbolDefined } from './UC/helpers';
import { enumerateDocuments } from './UC/indexer';
import { isParamSymbol, isStruct, UCObjectSymbol } from './UC/Symbols';

export function getWorkspaceSymbols(query: string): WorkspaceSymbol[] | undefined {
    const workspaceSymbols: WorkspaceSymbol[] = [];
    for (let document of enumerateDocuments()) {
        for (let symbol of document.enumerateSymbols()) {
            if (isSymbolDefined(symbol)) {
                buildWorkSpaceSymbols(symbol);
            }
        }

        function buildWorkSpaceSymbols(symbol: UCObjectSymbol) {
            if (isParamSymbol(symbol)) {
                return;
            }
            workspaceSymbols.push(toWorkspaceSymbol(symbol));
            if (isStruct(symbol)) {
                for (let child = symbol.children; child != null; child = child.next) {
                    if (isSymbolDefined(symbol)) {
                        buildWorkSpaceSymbols(child);
                    }
                }
            }
        }

        function toWorkspaceSymbol(symbol: UCObjectSymbol): WorkspaceSymbol {
            const workspaceSymbol: WorkspaceSymbol = {
                name: symbol.id.name.text,
                kind: SymbolKindMap.get(symbol.kind) ?? SymbolKind.Null,
                tags: getSymbolTags(symbol),
                location: {
                    uri: document.uri,
                    range: symbol.id.range
                },
                containerName: symbol.outer?.id.name.text
            };
            return workspaceSymbol;
        }
    }
    return workspaceSymbols;
}
