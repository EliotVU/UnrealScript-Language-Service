import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import { UCSymbolReference, UCStructSymbol } from ".";

export class UCStateSymbol extends UCStructSymbol {
	public ignoreRefs?: UCSymbolReference[];

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.ignoreRefs) {
			const symbol = this.ignoreRefs.find(ref => !!(ref.getSymbolAtPos(position)));
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findSuperSymbol(id: Name) {
		const symbol = super.findSuperSymbol(id) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id);
		return symbol;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = this.findSuperSymbol(ref.getId());
			symbol && ref.setReference(symbol, document);
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitState(this);
	}
}