import * as path from 'path';

import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISymbol } from './ISymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCStructSymbol } from "./";
import { UCDocumentListener, getDocumentById, indexDocument } from '../DocumentListener';

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbolContainer<ISymbol> {
	public outer = null;
	public symbols = new Map<string, ISymbol>();

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
		return '';
	}

	getTooltip(): string {
		return this.getName();
	}

	addSymbol(symbol: ISymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	/**
	 * Looks up a symbol by a qualified identifier in the current package or its subpackages.
	 * @param qualifiedId any valid qualified id e.g. Engine.Actor.EDrawType in lowercase.
	 * @param deepSearch
	 */
	public findQualifiedSymbol(qualifiedId: string, deepSearch?: boolean): ISymbol {
		if (this === SymbolsTable) {
			for (let packageSymbol of (this.symbols as Map<string, UCPackage>).values()) {
				const symbol = packageSymbol.findQualifiedSymbol(qualifiedId, deepSearch);
				if (symbol) {
					return symbol;
				}
			}

			const document = getDocumentById(qualifiedId);
			if (document) {
				indexDocument(document);
				return document.class;
			}
			return undefined;
		}

		if (qualifiedId.indexOf('.') === -1) {
			return this.symbols.get(qualifiedId);
		}

		const ids = qualifiedId.split('.');
		const id = ids.shift();

		let symbol = this.symbols.get(id);
		if (!symbol) {
			return undefined;
		}

		if (ids.length == 0) {
			return symbol;
		}

		const nextQualifiedId = ids.join('.');
		if (symbol instanceof UCStructSymbol) {
			return symbol.findTypeSymbol(nextQualifiedId, deepSearch);
		}
		return this.findQualifiedSymbol(nextQualifiedId, deepSearch);
	}

	// FIXME: Not setup yet!
	getCompletionSymbols(_document: UCDocumentListener): ISymbol[] {
		const symbols: ISymbol[] = [];
		for (let symbol of this.symbols.values()) {
			symbols.push(symbol);
		}
		return symbols;
	}
}

export const SymbolsTable = new UCPackage('Workspace');