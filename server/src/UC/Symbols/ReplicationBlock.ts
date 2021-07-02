import { Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    ISymbol, UCClassSymbol, UCStructSymbol, UCSymbol, UCSymbolReference, UCTypeFlags
} from './';

export class UCReplicationBlock extends UCStructSymbol {
	public symbolRefs = new Map<Name, UCSymbolReference>();

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName().toString();
	}

	getCompletionSymbols(document: UCDocument, context: string): ISymbol[] {
		return super
			.getCompletionSymbols(document, context);
	}

	getContainedSymbolAtPos(position: Position) {
		for (let ref of this.symbolRefs.values()) {
			const symbol = ref.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getName());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitReplicationBlock(this);
	}
}
