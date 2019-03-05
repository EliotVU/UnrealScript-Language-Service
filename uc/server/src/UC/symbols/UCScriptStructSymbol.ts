import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCStructSymbol, UCSymbol, UCMethodSymbol, UCPropertySymbol } from './';

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

	getCompletionSymbols(): UCSymbol[] {
		const symbols: UCSymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			symbols.push(child);
		}

		for (let parent = this.super; parent; parent = parent.super) {
			for (let child = parent.children; child; child = child.next) {
				symbols.push(child);
			}
		}
		return symbols;
	}

	acceptCompletion(context: UCSymbol): boolean {
		return (context instanceof UCPropertySymbol || context instanceof UCMethodSymbol);
	}
}