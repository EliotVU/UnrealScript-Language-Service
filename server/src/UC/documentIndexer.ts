import { UCStructSymbol, UCClassSymbol, UCStateSymbol, UCMethodSymbol, UCReplicationBlock, UCDefaultPropertiesBlock, UCObjectSymbol } from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';
import { UCDocument } from './document';

/**
 * Will initiate the indexing of all struct symbols that contain a block.
 * The indexing of a block is handled separately here so that we can resolve recursive dependencies within blocks.
 */
export class DocumentIndexer extends DefaultSymbolWalker {
	constructor(private document: UCDocument) {
		super();
	}

	visitStructBase(symbol: UCStructSymbol) {
		for (let child = symbol.children; child; child = child.next) {
			if (child instanceof UCStructSymbol) {
				child.accept(this);
			}
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol) {
		return this.visitStructBase(symbol);
	}

	visitState(symbol: UCStateSymbol) {
		if (symbol.block) {
			symbol.block.index(this.document, symbol);
		}
		return this.visitStructBase(symbol);
	}

	visitMethod(symbol: UCMethodSymbol) {
		if (symbol.block) {
			symbol.block.index(this.document, symbol);
		}
		return symbol;
	}

	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock) {
		if (symbol.block) {
			symbol.block.index(this.document, symbol);
		}
		return this.visitStructBase(symbol);
	}

	visitReplicationBlock(symbol: UCReplicationBlock) {
		if (symbol.block) {
			symbol.block.index(this.document, symbol);
		}
		return symbol;
	}

	visitObjectSymbol(symbol: UCObjectSymbol) {
		if (symbol.block) {
			symbol.block.index(this.document, symbol.super || symbol);
		}
		return this.visitStructBase(symbol);
	}
}
