import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCPropertySymbol } from './';

export class UCLocalSymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTypeTooltip(): string {
		return 'local';
	}
}