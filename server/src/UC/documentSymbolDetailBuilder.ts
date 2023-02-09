import { SymbolDetailBuilderVisitor } from './SymbolDetailBuilderVisitor';
import { UCObjectSymbol } from './Symbols';

const SymbolDetailBuilder = new SymbolDetailBuilderVisitor();

export function getSymbolDetail(symbol: UCObjectSymbol): string {
    return symbol.accept(SymbolDetailBuilder) as string;
}
