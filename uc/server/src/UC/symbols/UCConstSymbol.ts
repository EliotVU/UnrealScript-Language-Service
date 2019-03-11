import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCFieldSymbol } from "./";

export class UCConstSymbol extends UCFieldSymbol {
	public value: string;

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		return 'const ' + this.getQualifiedName() + ' = ' + this.value;
	}
}
