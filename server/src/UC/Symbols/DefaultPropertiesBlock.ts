import { SymbolKind } from 'vscode-languageserver';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCStructSymbol, UCSymbol, UCTypeFlags } from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

    findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
		const symbol = super.findSuperSymbol<T>(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
		return symbol;
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return false;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitDefaultPropertiesBlock(this);
	}
}
