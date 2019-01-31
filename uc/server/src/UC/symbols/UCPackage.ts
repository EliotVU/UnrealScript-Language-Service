import * as path from 'path';

import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCStructSymbol } from "./";

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

	addSymbol(symbol: ISimpleSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	/**
	 * Looks up a symbol by a qualified identifier in the current package or its subpackages.
	 * @param qualifiedId any valid qualified id e.g. Engine.Actor.EDrawType in lowercase.
	 * @param deepSearch
	 */
	public findQualifiedSymbol(qualifiedId: string, deepSearch?: boolean): ISimpleSymbol {
		var ids = qualifiedId.split('.');
		if (ids.length > 1) {
			let id = ids.shift();
			let symbol = this.symbols.get(id);
			if (symbol && symbol instanceof UCStructSymbol) {
				return symbol.findSuperSymbol(ids.join('.'), deepSearch);
			} else {
				return this.findQualifiedSymbol(ids.join('.'), deepSearch);
			}
		}

		var symbol = this.symbols.get(qualifiedId);
		if (symbol || !deepSearch) {
			return symbol;
		}

		for ([, symbol] of this.symbols) {
			if (symbol instanceof UCPackage) {
				symbol = symbol.findQualifiedSymbol(qualifiedId, deepSearch);
				if (symbol) {
					return symbol;
				}
			}
		}
	}
}