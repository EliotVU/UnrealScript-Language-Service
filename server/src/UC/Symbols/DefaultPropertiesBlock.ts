import { SymbolKind } from 'vscode-languageserver';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';

import { UCSymbol, UCStructSymbol } from '.';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return false;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDefaultPropertiesBlock(this);
	}
}
