import { UCMethodSymbol, UCObjectSymbol } from './UC/Symbols';
import { DumbSymbolWalker } from './UC/symbolWalker';

class SymbolDetailBuilderVisitor extends DumbSymbolWalker<string> {
    override visitMethod(symbol: UCMethodSymbol): string {
        return "()";
    }
}

const SymbolDetailBuilder = new SymbolDetailBuilderVisitor();

export function getSymbolDetail(symbol: UCObjectSymbol): string {
    return symbol.accept(SymbolDetailBuilder) as string;
}
