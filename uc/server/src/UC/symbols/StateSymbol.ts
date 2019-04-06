import { SymbolKind } from 'vscode-languageserver-types';

import { UCStructSymbol, UCSymbol } from ".";

export class UCStateSymbol extends UCStructSymbol {
	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): UCSymbol | undefined {
		return (this.outer as UCStructSymbol).findTypeSymbol(qualifiedId, deepSearch);
	}
}