import { SymbolKind } from 'vscode-languageserver';

import { UCDocument } from '../document';
import { UCSymbol, UCClassSymbol, UCScriptStructSymbol, UCStructSymbol } from '.';

export class UCDefaultPropertiesBlock extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol || context instanceof UCScriptStructSymbol;
	}
}
