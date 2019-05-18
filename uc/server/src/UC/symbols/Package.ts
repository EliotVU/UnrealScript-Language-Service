import * as path from 'path';

import { SymbolKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument, getDocumentById, indexDocument } from '../DocumentListener';

import { ISymbolContainer } from './ISymbolContainer';
import { ISymbol, UCStructSymbol } from ".";
import { SymbolVisitor } from '../SymbolVisitor';

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbol, ISymbolContainer<ISymbol> {
	public outer = null;

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
		return undefined;
	}

	addSymbol(symbol: ISymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getId(), symbol);
	}

	getSymbol(id: string): ISymbol {
		return this.symbols.get(id);
	}

	/**
	 * Looks up a symbol by a qualified identifier in the current package or its subPackages.
	 * @param qualifiedId any valid qualified id e.g. Engine.Actor.EDrawType in lowercase.
	 * @param deepSearch
	 */
	findSymbol(qualifiedId: string, deepSearch?: boolean): ISymbol {
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
		return this.findSymbol(nextQualifiedId, deepSearch);
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visit(this);
	}
}

class UCWorkspace extends UCPackage {
	findSymbol(qualifiedId: string, deepSearch?: boolean): ISymbol {
		for (let packageSymbol of (this.symbols as Map<string, UCPackage>).values()) {
			const symbol = packageSymbol.findSymbol(qualifiedId, deepSearch);
			if (symbol) {
				return symbol;
			}
		}

		const document = getDocumentById(qualifiedId);
		if (document) {
			if (!document.class) {
				indexDocument(document);
			}
			return document.class;
		}
		return this.getSymbol(qualifiedId);
	}
}

export const SymbolsTable = new UCWorkspace('Workspace');