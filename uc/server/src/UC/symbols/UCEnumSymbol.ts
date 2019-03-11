import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCStructSymbol, UCSymbol } from './';
import { UCDocumentListener } from '../DocumentListener';

export class UCEnumSymbol extends UCStructSymbol {
	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getQualifiedName()}`;
	}

	getCompletionSymbols(document: UCDocumentListener): UCSymbol[] {
		const symbols: UCSymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}
		return symbols;
	}
}