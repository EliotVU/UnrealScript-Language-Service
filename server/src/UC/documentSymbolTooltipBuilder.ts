import { ISymbol } from './Symbols';
import { SymbolTooltipBuilder } from './SymbolTooltipBuilder';

const symbolTooltipBuilder = new SymbolTooltipBuilder();

export function getSymbolTooltip(symbol: ISymbol): string {
    // Ensure 'void' is cast to string
    return String(symbol.accept(symbolTooltipBuilder));
}
