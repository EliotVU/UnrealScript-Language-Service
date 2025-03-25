import { type Hover, MarkupKind, type Position } from 'vscode-languageserver';
import type { UCDocument } from './UC/document';
import { getSymbolTooltip } from './UC/documentSymbolTooltipBuilder';
import { getDocumentSymbol, getSymbolDocumentation, resolveSymbolToRef } from './UC/helpers';
import type { ISymbol } from './UC/Symbols';

/**
 * Returns a `Hover` object describing a symbol that is encompassing the passed position in the given document.
 */
export async function getDocumentHover(
    document: UCDocument,
    position: Position
): Promise<Hover | undefined> {
    const symbol = getDocumentSymbol(document, position);
    if (!symbol) {
        return undefined;
    }

    return getSymbolDocumentHover(document, symbol);
}

/**
 * Returns a `Hover` object describing the symbol.
 */
export function getSymbolDocumentHover(
    document: UCDocument, // placeholder
    symbol: ISymbol
): Hover | undefined {
    const definitionSymbol = resolveSymbolToRef(symbol);
    if (!definitionSymbol) {
        return undefined;
    }

    const tooltipText = getSymbolTooltip(definitionSymbol);
    const output = [`\`\`\`unrealscript`, tooltipText, `\`\`\``,];
    const documentation = getSymbolDocumentation(definitionSymbol);
    if (documentation) {
        output.push(
            '___',
            documentation.join('\n\n')
        );
    }

    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: output.join('\n')
        },
        range: symbol.id.range
    };
}
