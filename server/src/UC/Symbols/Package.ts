import { SymbolKind } from 'vscode-languageserver-types';

import { getDocumentById, indexDocument } from '../indexer';
import { Name, NAME_NONE } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_RANGE, ISymbol, ISymbolContainer, UCClassSymbol, UCFieldSymbol, UCStructSymbol, UCSymbol
} from './';
import { UCTypeFlags } from './TypeSymbol';

export class SymbolsTable<T extends ISymbol> implements ISymbolContainer<T> {
	protected symbols = new Map<number, T>();

    count() {
        return this.symbols.size;
    }

	getAll<C extends T>() {
		return this.symbols.values() as IterableIterator<C>;
	}

    *getTypes<C extends T>(type: UCTypeFlags): Generator<C, C[]> {
        for (const symbol of this.symbols.values()) {
            if ((symbol.getTypeFlags() & type) === 0) {
                continue;
            }
            yield symbol as C;
        }
        return [];
    }

	addSymbol(symbol: T): number {
		return this.addKey(getSymbolHash(symbol), symbol);
	}

	addKey(key: number, symbol: T) {
		const other = this.symbols.get(key);
		if (other) {
            if (other === symbol) {
                return key;
            }
			if (other.getKind() !== symbol.getKind()) {
				symbol.nextInHash = other;
			}
		}
		this.symbols.set(key, symbol);
		return key;
	}

	removeSymbol(symbol: T) {
		const key = getSymbolHash(symbol);
		this.removeKey(key, symbol);
	}

	removeKey(key: number, symbol: T) {
		const other = this.symbols.get(key);
		if (!other) {
			return;
		}

		if (other.getKind() === symbol.getKind()) {
			this.symbols.delete(key);
			if (other.nextInHash) {
				this.addKey(key, other.nextInHash as T);
				delete other.nextInHash;
			}
		} else {
			for (let next = other; next; next = next.nextInHash as T) {
				if (next.nextInHash && next.nextInHash.getKind() === symbol.getKind()) {
					next.nextInHash = symbol.nextInHash;
					break;
				}
			}
		}
	}

	getSymbol<C extends T>(key: Name | number, type?: UCTypeFlags, outer?: ISymbol): C | undefined {
		const symbol = this.symbols.get(typeof(key) === 'number' ? key : key.hash);
		if (!type) {
			return symbol as C;
		}
		for (let next = symbol; next; next = next.nextInHash as T) {
			if ((next.getTypeFlags() & type) === type && (next.outer === outer || !outer)) {
				return next as C;
			}
		}
		return undefined;
	}

	clear(): void {
		// naive implementation, what if two classes have an identical named struct?
		const removeObjects = (child?: UCFieldSymbol) => {
			for (; child; child = child.next) {
				if (child instanceof UCStructSymbol) {
					if (child.children) {
						removeObjects(child.children);
					}
				}
				this.removeSymbol(child as unknown as T);
			}
		};

		for (const [key, symbol] of this.symbols) {
			if (symbol instanceof UCStructSymbol) {
				removeObjects(symbol.children);
				this.removeKey(key, symbol);
			}
		}
	}
}

export class UCPackage extends UCSymbol {
	constructor(name: Name) {
		super({ name, range: DEFAULT_RANGE });
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getTypeFlags() {
		return UCTypeFlags.Package;
	}

	getTooltip(): string {
		return 'package ' + this.getName();
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
export const OuterObjectsTable = new SymbolsTable<UCSymbol>();

export function getSymbolHash(symbol: ISymbol) {
	return symbol.getName().hash;
}

export function getSymbolOuterHash(symbolHash: number, outerHash: number) {
	return symbolHash + (outerHash >> 4);
}

export function addHashedSymbol(symbol: UCSymbol) {
	const key = getSymbolHash(symbol);
	ObjectsTable.addKey(key, symbol);
	if (symbol.outer) {
		OuterObjectsTable.addKey(getSymbolOuterHash(key, getSymbolHash(symbol.outer)), symbol);
	}
    return key;
}

export function removeHashedSymbol(symbol: UCSymbol) {
	const key = getSymbolHash(symbol);
	ObjectsTable.removeKey(key, symbol);
	if (symbol.outer) {
		OuterObjectsTable.removeKey(getSymbolOuterHash(key, getSymbolHash(symbol.outer)), symbol);
	}
    return key;
}

export function findOrIndexClassSymbol(id: Name): UCClassSymbol | undefined {
	const document = getDocumentById(id);
	if (document) {
		if (!document.hasBeenIndexed) {
			indexDocument(document);
		}
		return document.class;
	}
	return undefined;
}

export function tryFindSymbolInPackage<T extends UCSymbol>(id: Name, pkg: UCPackage, type?: UCTypeFlags): ISymbol | undefined {
	const key = getSymbolOuterHash(id.hash, getSymbolHash(pkg));
	const symbol = OuterObjectsTable.getSymbol<T>(key, type, pkg);
	if (!symbol) {
		// Package may have a class that hasn't been indexed yet.
		const classSymbol = findOrIndexClassSymbol(id);
		if (classSymbol?.outer === pkg) {
			return classSymbol;
		}
	}
	else if (symbol.outer === pkg) {
		return symbol;
	}
	return undefined;
}

export function tryFindClassSymbol(id: Name): UCClassSymbol | undefined {
	const symbol = ObjectsTable.getSymbol<UCClassSymbol>(id.hash, UCTypeFlags.Class) ?? findOrIndexClassSymbol(id);
	return symbol;
}