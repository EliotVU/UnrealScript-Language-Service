import * as path from 'path';

import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbolContainer<ISimpleSymbol> {
	public outer = null;
	public symbols = new Map<string, ISimpleSymbol>();

	private name: string;

	constructor(uri: string) {
		this.name = path.basename(uri);
	}

	getName(): string {
		return this.name;
	}

	getQualifiedName(): string {
		return this.getName();
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Module;
	}

	getUri(): string {
		throw new Error("getUri not implemented");
	}

	getTooltip(): string {
		return this.getName();
	}

	add(symbol: ISimpleSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	public findSuperSymbol(name: string, deepSearch?: boolean): ISimpleSymbol {
		var symbol = this.symbols.get(name);
		if (symbol || !deepSearch) {
			return symbol;
		}

		for (symbol of this.symbols.values()) {
			if (symbol instanceof UCPackage) {
				symbol = symbol.findSuperSymbol(name);
				if (symbol) {
					return symbol;
				}
			}
		}
	}
}