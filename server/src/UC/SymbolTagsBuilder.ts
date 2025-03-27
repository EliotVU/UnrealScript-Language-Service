import { SymbolTag, type DocumentSymbol } from 'vscode-languageserver';

import { UCClassSymbol, UCFieldSymbol, UCMethodSymbol, UCPropertySymbol } from './Symbols';
import { ModifierFlags } from './Symbols/ModifierFlags';
import { DumbSymbolWalker } from './symbolWalker';

// Transform field modifiers to their corresponding SymbolTag counter-part.
function visitField(symbol: UCFieldSymbol): SymbolTag[] | undefined {
    if (symbol.modifiers & ModifierFlags.Deprecated) {
        return [SymbolTag.Deprecated];
    }

    return undefined;
}

/**
 * A visitor to build the "tags" property for any particular symbol.
 *
 * @see DocumentSymbol.tags
 * @see SymbolTag
 */
export class SymbolTagsBuilder extends DumbSymbolWalker<SymbolTag[] | undefined> {
    override visitClass(symbol: UCClassSymbol) {
        return visitField(symbol);
    }

    override visitProperty(symbol: UCPropertySymbol) {
        return visitField(symbol);
    }

    override visitMethod(symbol: UCMethodSymbol) {
        return visitField(symbol);
    }
}
