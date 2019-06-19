import { SymbolKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { getDocumentById, indexDocument } from '../indexer';
import { Name, NAME_NONE } from '../names';

import { ISymbol, ISymbolContainer, UCClassSymbol } from '.';

export class UCPackage implements ISymbol, ISymbolContainer<ISymbol> {
	public outer?: UCPackage;
	protected symbols = new Map<Name, ISymbol>();

	constructor(private name: Name) {
	}

	getId(): Name {
		return this.name;
	}

	getQualifiedName(): string {
		return this.getId().toString();
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getTooltip(): string {
		return 'package ' + this.getId();
	}

	// FIXME: Not setup yet!
	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		const symbols: ISymbol[] = [];
		for (let symbol of this.symbols.values()) {
			symbols.push(symbol);
		}
		return symbols;
	}

	// TODO: implement
	toCompletionItem(_document: UCDocument): CompletionItem {
		return CompletionItem.create(this.getId().toString());
	}

	addSymbol(symbol: ISymbol): Name {
		const key = this.outer
			? this.outer.addSymbol(symbol)
			: symbol.getId();

		this.symbols.set(key, symbol);
		symbol.outer = this;

		// Classes are top level types, need to be added to the symbols table so they can be linked to from anywhere.
		if (symbol instanceof UCClassSymbol) {
			SymbolsTable.addSymbol(symbol);
		}

		return key;
	}

	getSymbol(id: Name): ISymbol | undefined {
		return this.symbols.get(id);
	}

	findSymbol(id: Name, deepSearch?: boolean): ISymbol | undefined {
		const symbol = this.getSymbol(id);
		if (symbol) {
			return symbol;
		}

		if (deepSearch) {
			const document = getDocumentById(id.toString().toLowerCase());
			if (document) {
				if (!document.class) {
					indexDocument(document);
				}
				return document.class;
			}
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}

class UCWorkspace extends UCPackage {
	// Don't register, just map it for quick lookups!
	addSymbol(symbol: ISymbol): Name {
		const key = symbol.getId();
		this.symbols.set(key, symbol);
		if (symbol instanceof UCPackage) {
			symbol.outer = this;
		}
		return key;
	}
}

/**
 * The symbols table is where all Class types are supposed to be stored.
 * This table will be used to index any class references, including any native psuedo class.
 */
export const SymbolsTable = new UCWorkspace(NAME_NONE);

/**
 * Contains all indexed packages, including the predefined "Core" package.
 */
export const PackagesTable = new UCWorkspace(NAME_NONE);