import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCStructSymbol } from './';

export class UCEnumSymbol extends UCStructSymbol {
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