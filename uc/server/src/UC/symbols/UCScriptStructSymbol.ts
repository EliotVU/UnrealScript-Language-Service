import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { UCStructSymbol } from './';

export class UCScriptStructSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Struct;
	}

	getTooltip(): string {
		return `struct ${this.getQualifiedName()}`;
	}
}