import { SymbolKind } from 'vscode-languageserver-types';

import { UCStructSymbol } from "./";

export class UCStateSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
	}
}