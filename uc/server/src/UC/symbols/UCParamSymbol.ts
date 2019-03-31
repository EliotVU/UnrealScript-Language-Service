import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCPropertySymbol } from './';

export class UCParamSymbol extends UCPropertySymbol {
	isPrivate(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTypeTooltip(): string {
		return '(parameter)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getName()}`;
	}
}