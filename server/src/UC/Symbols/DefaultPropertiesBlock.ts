

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    isArchetypeSymbol, ModifierFlags, UCFieldSymbol, UCObjectSymbol, UCStructSymbol, UCSymbolKind
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

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
        // We assume that @default is set to either a class or an archetype (UE3)
        // If the default is an archetype then the archetype will look for its symbols in its own @super
		const symbol = this.default.findSuperSymbol<T>(id, kind);
		return symbol;
	}

	override acceptCompletion(_document: UCDocument, _context: UCObjectSymbol): boolean {
		return false;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitDefaultPropertiesBlock(this);
	}
}
