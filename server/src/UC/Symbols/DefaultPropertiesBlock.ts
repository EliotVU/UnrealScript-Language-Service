import { SymbolWalker } from '../symbolWalker';
import {
    getContext,
    isArchetypeSymbol, ModifierFlags, UCClassSymbol, UCStructSymbol, UCSymbolKind
} from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
    override kind = UCSymbolKind.DefaultPropertiesBlock;
    override modifiers = ModifierFlags.NoDeclaration;

    override getTooltip(): string {
        const outerClass = getContext<UCClassSymbol>(this, UCSymbolKind.Class);
        if (outerClass?.defaults && isArchetypeSymbol(outerClass.defaults)) {
            return `(${this.id.name.text.toLowerCase()}) ${outerClass.getTooltip()}`;
        }

        return `(${this.id.name.text.toLowerCase()})`;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDefaultPropertiesBlock(this);
    }
}
