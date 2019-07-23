import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../names';

import { ReliableKeyword, UnreliableKeyword, IfKeyword } from './Keywords';
import {
	ISymbol, UCSymbol,
	UCClassSymbol, UCStructSymbol,
	UCSymbolReference
} from '.';

export class UCReplicationBlock extends UCStructSymbol {
	public symbolRefs = new Map<Name, UCSymbolReference>();

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getId().toString();
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return super
			.getCompletionSymbols(_document)
			.concat(ReliableKeyword, UnreliableKeyword, IfKeyword);
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
		console.assert(document.class, 'Tried to index a replication block without a class reference!');
		// We index our block here, because in the parent class a block is no longer indexed automatically.
		if (this.block) {
			this.block.index(document, document.class!);
		}
		super.index(document, document.class!);

		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getId());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}
}
