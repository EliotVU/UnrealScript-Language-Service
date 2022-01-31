

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
    override kind = UCSymbolKind.DefaultPropertiesBlock;

    findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
		const symbol = (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
		return symbol;
	}

	acceptCompletion(_document: UCDocument, _context: UCObjectSymbol): boolean {
		return false;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitDefaultPropertiesBlock(this);
	}
}
