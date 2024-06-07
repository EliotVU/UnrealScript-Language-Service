import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextKind,
    getContext,
    isArchetypeSymbol, ISymbol, ModifierFlags, UCClassSymbol, UCStructSymbol, UCSymbolKind
} from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
    override kind = UCSymbolKind.DefaultPropertiesBlock;
    override modifiers = ModifierFlags.NoDeclaration;

    override getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: ContextKind, kinds?: UCSymbolKind | undefined): C[] {
        const outerClass = getContext<UCClassSymbol>(this, UCSymbolKind.Class);
        if (outerClass) {
            return outerClass.defaults.getCompletionSymbols<C>(document, context, kinds);
        }

        return super.getCompletionSymbols(document, context, kinds);
    }

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
