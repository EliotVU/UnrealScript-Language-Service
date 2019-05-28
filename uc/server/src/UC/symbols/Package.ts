import * as path from 'path';

import { SymbolKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument, getDocumentById, indexDocument } from '../DocumentListener';
import { SymbolWalker } from '../symbolWalker';

import { ISymbol, UCStructSymbol } from ".";
import { ISymbolContainer } from './ISymbolContainer';

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbol, ISymbolContainer<ISymbol> {
	public outer?: UCPackage;

	protected symbols = new Map<string, ISymbol>();
	private name: string;

	constructor(uri: string) {
		this.name = path.basename(uri);
	}

	getName(): string {
		return this.name;
	}

	getId(): string {
		return this.name.toLowerCase();
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

	addSymbol(symbol: ISymbol): string {
		const key = this.outer
			? this.outer.addSymbol(symbol)
			: symbol.getId();

		this.symbols.set(key, symbol);
		symbol.outer = this;
		return key;
	}

	getSymbol(id: string): ISymbol | undefined {
		return this.symbols.get(id);
	}

	/**
	 * Looks up a symbol by a qualified identifier in the current package or its subPackages.
	 * @param qualifiedId any valid qualified id e.g. Engine.Actor or Actor.EDrawType in lowercase.
	 * @param deepSearch
	 */
	findSymbol(qualifiedId: string, deepSearch?: boolean): ISymbol | undefined {
		if (qualifiedId.indexOf('.') !== -1) {
			const ids = qualifiedId.split('.');

			const id = ids.shift();
			if (!id) {
				// e.g. "Actor."
				return undefined;
			}

			let symbol = this.symbols.get(id);
			if (!symbol) {
				return undefined;
			}

			if (ids.length == 0) {
				return symbol;
			}

			const nextQualifiedId = ids.join('.');
			if (symbol instanceof UCStructSymbol) {
				// TODO: Use findSymbol?, so that we can match invalid types, and report a warning/error.
				return symbol.findTypeSymbol(nextQualifiedId, true);
			} else if (symbol instanceof UCPackage) {
				return symbol.findSymbol(nextQualifiedId, false);
			}
		}
		else {
			const symbol = this.getSymbol(qualifiedId);
			if (symbol) {
				return symbol;
			}

			if (deepSearch) {
				const document = getDocumentById(qualifiedId);
				if (document) {
					if (!document.class) {
						indexDocument(document);
					}
					return document.class;
				}
			}
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}

class UCWorkspace extends UCPackage {
	// Don't register, just map it for quick lookups!
	addSymbol(symbol: ISymbol): string {
		const key = symbol.getId();
		this.symbols.set(key, symbol);
		if (symbol instanceof UCPackage) {
			symbol.outer = this;
		}
		return key;
	}
}

export const SymbolsTable = new UCWorkspace('Workspace');