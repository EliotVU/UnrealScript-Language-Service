import { SymbolKind, WorkspaceSymbol } from 'vscode-languageserver';

import { isDocumentSymbol, SymbolKindMap } from './documentSymbol';
import { getSymbolTags } from './documentSymbolTagsBuilder';
import { documentsMap } from './UC/indexer';
import { isParamSymbol, isStruct, UCObjectSymbol } from './UC/Symbols';

export function getWorkspaceSymbols(query: string): WorkspaceSymbol[] | undefined {
    const workspaceSymbols: WorkspaceSymbol[] = [];
    Array
        .from(documentsMap.values())
        .forEach(document => {
            for (let symbol of document.getSymbols()) {
                if (isDocumentSymbol(symbol)) {
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
                        if (isDocumentSymbol(symbol)) {
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
        });

    return workspaceSymbols;
}
