import { SymbolKind } from 'vscode-languageserver-types';

import { UCStructSymbol, UCSymbol } from ".";
import { SymbolVisitor } from '../SymbolVisitor';

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

	findSuperSymbol(id: string): UCSymbol {
		return super.findSuperSymbol(id)
			|| (this.outer instanceof UCStructSymbol && this.outer.findSuperSymbol(id));
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): UCSymbol {
		return (this.outer as UCStructSymbol).findTypeSymbol(qualifiedId, deepSearch);
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitState(this);
	}
}