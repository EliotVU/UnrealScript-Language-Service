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

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): UCSymbol {
		return (this.outer as UCStructSymbol).findTypeSymbol(qualifiedId, deepSearch);
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitState(this);
	}
}