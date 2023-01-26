import { SymbolTag } from 'vscode-languageserver';

import {
    ModifierFlags, UCClassSymbol, UCFieldSymbol, UCMethodSymbol, UCObjectSymbol, UCPropertySymbol
} from './UC/Symbols';
import { DumbSymbolWalker } from './UC/symbolWalker';

// Transform field modifiers to their corresponding SymbolTag counter-part.
function visitField(symbol: UCFieldSymbol): SymbolTag[] | undefined {
    if (symbol.modifiers & ModifierFlags.Deprecated) {
        return [SymbolTag.Deprecated];
    }
    return undefined;
}

class SymbolTagsBuilderVisitor extends DumbSymbolWalker<SymbolTag[] | undefined> {
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

const SymbolTagsBuilder = new SymbolTagsBuilderVisitor();

export function getSymbolTags(symbol: UCObjectSymbol): SymbolTag[] | undefined {
    return symbol.accept(SymbolTagsBuilder) as SymbolTag[] | undefined;
}