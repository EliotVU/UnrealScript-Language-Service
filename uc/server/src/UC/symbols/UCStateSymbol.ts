import { SymbolKind } from 'vscode-languageserver-types';

import { UCStructSymbol } from "./UCStructSymbol";

export class UCStateSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
	}
}