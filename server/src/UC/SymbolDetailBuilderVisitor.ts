import { UCMethodSymbol } from './Symbols';
import { DumbSymbolWalker } from './symbolWalker';

export class SymbolDetailBuilderVisitor extends DumbSymbolWalker<string> {
    override visitMethod(symbol: UCMethodSymbol): string {
        return "()";
    }
}
