import * as path from 'path';

import { SymbolKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { getDocumentById, indexDocument } from '../indexer';
import { Name, toName } from '../names';

import { ISymbol } from ".";
import { ISymbolContainer } from './ISymbolContainer';

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbol, ISymbolContainer<ISymbol> {
	public outer?: UCPackage;

	protected symbols = new Map<Name, ISymbol>();
	private name: Name;

	constructor(uri: string) {
		this.name = toName(path.basename(uri));
	}

	getName(): string {
		return this.name.toString();
	}

	getId(): Name {
		return this.name;
	}

	getQualifiedName(): string {
		return this.getName();
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getTooltip(): string {
		return this.getName();
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
		return CompletionItem.create(this.getName());
	}

	addSymbol(symbol: ISymbol): Name {
		const key = this.outer
			? this.outer.addSymbol(symbol)
			: symbol.getId();

		this.symbols.set(key, symbol);
		symbol.outer = this;
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

export const SymbolsTable = new UCWorkspace('Workspace');