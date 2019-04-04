import { SymbolKind } from 'vscode-languageserver-types';

import { UCStructSymbol } from "./";
import { UCSymbol } from './UCSymbol';

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