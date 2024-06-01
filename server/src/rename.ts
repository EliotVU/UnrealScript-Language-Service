import { getSymbolReferences } from 'references';
import { TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { DocumentUri, Position } from 'vscode-languageserver-textdocument';
import { ISymbol, SymbolReferenceFlags } from './UC/Symbols';
import { getSymbolDefinition } from './UC/helpers';

// Not to be confused with the renaming of a document... 'Document' here is just a namespace for doing anything within a document ;)
export async function getDocumentRenameEdit(uri: DocumentUri, position: Position, newName: string): Promise<WorkspaceEdit | undefined> {
    const symbol = getSymbolDefinition(uri, position);
    if (!symbol) {
        return undefined;
    }

    return getSymbolRenameEdit(symbol, newName);
}

/**
 * Gets a `WorkspaceEdit` of changes to be made in order to rename a particular symbol.
 *
 * @param symbol the symbol the new name is for.
 * @param newName the new name for the symbol.
 * @returns the changes to be made or undefined if no references were found.
 */
export function getSymbolRenameEdit(symbol: ISymbol, newName: string): WorkspaceEdit | undefined {
    const references = getSymbolReferences(symbol, SymbolReferenceFlags.All);
    if (!references) {
        return undefined;
    }

    const changes: { [uri: DocumentUri]: TextEdit[] } = {};
    references.forEach(l => {
        const ranges = changes[l.uri] ?? (changes[l.uri] = []);
        ranges.push(TextEdit.replace(l.range, newName));
    });

    return { changes };
}
