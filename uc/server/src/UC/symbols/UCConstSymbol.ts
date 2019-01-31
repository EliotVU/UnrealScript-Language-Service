import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { Token } from 'antlr4ts';
import { UCFieldSymbol } from "./";

export class UCConstSymbol extends UCFieldSymbol {
	public valueToken: Token;

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		return '(const) ' + this.getQualifiedName() + ' : ' + this.valueToken.text;
	}
}
