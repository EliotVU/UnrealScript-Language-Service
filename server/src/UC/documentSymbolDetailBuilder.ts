import { SymbolDetailBuilder } from './SymbolDetailBuilder';
import { UCObjectSymbol } from './Symbols';

const symbolDetailBuilder = new SymbolDetailBuilder();

export function getSymbolDetail(symbol: UCObjectSymbol): string {
    return symbol.accept(symbolDetailBuilder) as string;
}
