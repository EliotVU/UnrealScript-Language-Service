import { SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { getDocumentById, indexDocument } from '../indexer';
import { Name, NAME_NONE } from '../names';

import { ISymbol, ISymbolContainer, UCClassSymbol, DEFAULT_RANGE, UCSymbol } from '.';
import { UCTypeFlags } from './TypeSymbol';

export class SymbolsTable<T extends ISymbol> implements ISymbolContainer<T> {
	protected symbols = new WeakMap<Name, T>();

	addSymbol(symbol: T): Name {
		const key = symbol.getId();
		const other = this.getSymbol(key);
		if (other === symbol) {
			return key;
		}

		if (other) {
			symbol.nextInHash = other;
		}
		this.symbols.set(key, symbol);
		return key;
	}

	removeSymbol(symbol: T) {
		const key = symbol.getId();
		const other = this.getSymbol(key);
		if (!other) {
			return;
		}

		if (other === symbol) {
			this.symbols.delete(key);
			if (other.nextInHash) {
				this.addSymbol(other.nextInHash as T);
				delete other.nextInHash;
			}
		} else {
			for (let next = other; next; next = next.nextInHash as T) {
				if (next.nextInHash === symbol) {
					next.nextInHash = symbol.nextInHash;
					break;
				}
			}
		}
	}

	getSymbol<C extends T>(key: Name, type?: UCTypeFlags): C | undefined {
		const symbol = this.symbols.get(key);
		if (!type) {
			return symbol as C;
		}
		for (let next = symbol; next; next = next.nextInHash as T) {
			if ((next.getTypeFlags() & type) === type) {
				return next as C;
			}
		}
		return undefined;
	}
}

export class UCPackage extends UCSymbol {
	private scope = new SymbolsTable<ISymbol>();

	constructor(private name: Name) {
		super({ name, range: DEFAULT_RANGE });
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getTypeFlags() {
		return UCTypeFlags.Package;
	}

	getTooltip(): string {
		return 'package ' + this.getId();
	}

	getScope(): ISymbolContainer<ISymbol> {
		return this.scope;
	}

	getSymbol(id: Name, type?: UCTypeFlags) {
		return this.scope.getSymbol(id, type);
	}

	addSymbol(symbol: ISymbol): Name {
		symbol.outer = this;
		ObjectsTable.addSymbol(symbol as UCClassSymbol);
		return this.scope.addSymbol(symbol);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitPackage(this);
	}
}

export const TRANSIENT_PACKAGE = new UCPackage(NAME_NONE);

/**
 * A symbols table of kinds such as UPackage, UClass, UStruct, and UEnums.
 */
export const ObjectsTable = new SymbolsTable<UCSymbol>();

function findOrIndexClassSymbol(id: Name): UCClassSymbol | undefined {
	const document = getDocumentById(id.toString().toLowerCase());
	if (document) {
		if (!document.hasBeenIndexed) {
			indexDocument(document);
		}
		return document.class;
	}
	return undefined;
}

export function tryFindSymbolInPackage(id: Name, pkg: UCPackage): ISymbol | undefined {
	// Package may have a class that hasn't been indexed yet.
	const symbol = pkg.getSymbol(id) ?? findOrIndexClassSymbol(id);
	return symbol;
	// return symbol?.outer === pkg ? symbol : undefined;
}

export function tryFindClassSymbol(id: Name): UCClassSymbol | undefined {
	const symbol = ObjectsTable.getSymbol<UCClassSymbol>(id, UCTypeFlags.Class) ?? findOrIndexClassSymbol(id);
	return symbol;
}