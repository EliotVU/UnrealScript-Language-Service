import { SymbolWalker } from '../symbolWalker';
import {
    isArchetypeSymbol, ModifierFlags, UCFieldSymbol, UCStructSymbol, UCSymbolKind
} from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
    override kind = UCSymbolKind.DefaultPropertiesBlock;
    override modifiers = ModifierFlags.NoDeclaration;

    // Generated symbol (not passed to a visitor)
    // Set to either the document's class or a generated Default_ClassName archetype.
    public default: UCStructSymbol;

    override getTooltip(): string {
        return `(${this.id.name.text.toLowerCase()}) ${this.default.getTooltip()}`;
    }

    override addSymbol(symbol: UCFieldSymbol): number | undefined {
        const r = super.addSymbol(symbol);
        if (isArchetypeSymbol(symbol)) {
            symbol.outer = this.default;
        }
        return r;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDefaultPropertiesBlock(this);
    }
}
