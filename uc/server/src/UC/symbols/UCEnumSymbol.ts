import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCFieldSymbol } from './UCFieldSymbol';

export class UCEnumSymbol extends UCFieldSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getQualifiedName()}`;
	}
}