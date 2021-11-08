import { SymbolKind } from 'vscode-languageserver';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { UCStructSymbol, UCSymbol, UCTypeFlags } from './';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return false;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDefaultPropertiesBlock(this);
	}
}
