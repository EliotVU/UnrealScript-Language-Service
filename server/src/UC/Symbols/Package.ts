import { getDocumentById, indexDocument } from '../indexer';
import { Name, NameHash } from '../name';
import { NAME_NONE } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_RANGE,
    isStruct,
    ISymbol,
    ISymbolContainer,
    UCClassSymbol,
    UCFieldSymbol,
    UCObjectSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';

export class SymbolsTable<T extends ISymbol> implements ISymbolContainer<T> {
    protected symbols = new Map<NameHash, T>();

    count() {
        return this.symbols.size;
    }

    enumerate(): IterableIterator<T> {
        return this.symbols.values();
    }

    *enumerateAll<C extends T>(): Generator<C, C[]> {
        for (const symbol of this.symbols.values()) {
            for (let next = symbol.nextInHash; next; next = next.nextInHash as C) {
                yield next as C;
            }
            yield symbol as C;
        }
        return [];
    }

    *enumerateKinds<C extends T>(kinds: UCSymbolKind): Generator<C, C[]> {
        for (const symbol of this.symbols.values()) {
            if (((1 << symbol.kind) & kinds) !== 0) {
                yield symbol as C;
            }

            for (let next = symbol.nextInHash; next; next = next.nextInHash as C) {
                if (((1 << next.kind) & kinds) !== 0) {
                    yield next as C;
                }
            }
        }
        return [];
    }

    addSymbol(symbol: T): NameHash {
        return this.addKey(getSymbolHash(symbol), symbol);
    }

    addKey(key: NameHash, symbol: T) {
        const other = this.symbols.get(key);
        if (other) {
            if (other === symbol) {
                return key;
            }
            if (other.kind !== symbol.kind) {
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

    removeKey(key: NameHash, symbol: T) {
        const other = this.symbols.get(key);
        if (!other) {
            return;
        }

        if (other.kind === symbol.kind) {
            this.symbols.delete(key);
            if (other.nextInHash) {
                this.addKey(key, other.nextInHash as T);
                delete other.nextInHash;
            }
        } else {
            for (let next = other; next; next = next.nextInHash as T) {
                if (next.nextInHash && next.nextInHash.kind === symbol.kind) {
                    next.nextInHash = symbol.nextInHash;
                    break;
                }
            }
        }
    }

    getSymbol<C extends T>(key: Name | NameHash, kind?: UCSymbolKind, outer?: ISymbol): C | undefined {
        const symbol = this.symbols.get(typeof (key) === 'number' ? key : key.hash);
        if (symbol === undefined) {
            return undefined;
        }
        if (typeof kind === 'undefined') {
            return symbol as C | undefined;
        }
        if (typeof outer === 'undefined') {
            for (let next = symbol; next; next = next.nextInHash as T) {
                if (next.kind === kind) {
                    return next as C;
                }
            }
        } else {
            for (let next = symbol; next; next = next.nextInHash as T) {
                if (next.kind === kind && next.outer === outer) {
                    return next as C;
                }
            }
        }
        return undefined;
    }

    clear(): void {
        // naive implementation, what if two classes have an identical named struct?
        const removeObjects = (child?: UCFieldSymbol) => {
            for (; child; child = child.next) {
                if (isStruct(child)) {
                    if (child.children) {
                        removeObjects(child.children);
                    }
                }
                this.removeSymbol(child as unknown as T);
            }
        };

        for (const [key, symbol] of this.symbols) {
            if (isStruct(symbol)) {
                removeObjects(symbol.children);
                this.removeKey(key, symbol);
            }
        }
    }
}

export class UCPackage extends UCObjectSymbol {
    override kind = UCSymbolKind.Package;

    constructor(name: Name) {
        super({ name, range: DEFAULT_RANGE });
    }

    override getTypeKind() {
        return UCTypeKind.Object;
    }

    override getTooltip(): string {
        return `package ${this.getName().text}`;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitPackage(this);
    }
}

export const TRANSIENT_PACKAGE = new UCPackage(NAME_NONE);

/**
 * A symbols table of kinds such as UPackage, UClass, UStruct, and UEnums.
 */
export const ObjectsTable = new SymbolsTable<UCObjectSymbol>();
export const OuterObjectsTable = new SymbolsTable<UCObjectSymbol>();

export function getSymbolHash(symbol: ISymbol) {
    return symbol.id.name.hash;
}

export function getSymbolOuterHash(symbolHash: NameHash, outerHash: NameHash) {
    return symbolHash + (outerHash >> 4);
}

export function getSymbolPathHash(symbol: ISymbol): NameHash {
    let hash: NameHash = symbol.id.name.hash;
    for (let outer = symbol.outer; outer; outer = outer.outer) {
        hash = hash ^ (outer.id.name.hash >> 4);
    }
    return hash;
}

export function addHashedSymbol(symbol: UCObjectSymbol) {
    const key = getSymbolHash(symbol);
    ObjectsTable.addKey(key, symbol);
    if (symbol.outer) {
        OuterObjectsTable.addKey(getSymbolOuterHash(key, getSymbolHash(symbol.outer)), symbol);
    }
    return key;
}

export function removeHashedSymbol(symbol: UCObjectSymbol) {
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

export function tryFindSymbolInPackage<T extends UCObjectSymbol>(id: Name, pkg: UCPackage, kind?: UCSymbolKind): ISymbol | undefined {
    const key = getSymbolOuterHash(id.hash, getSymbolHash(pkg));
    const symbol = OuterObjectsTable.getSymbol<T>(key, kind, pkg);
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

export function tryFindClassSymbol(id: Name, kind: UCSymbolKind = UCSymbolKind.Class): UCClassSymbol | undefined {
    const symbol = ObjectsTable.getSymbol<UCClassSymbol>(id.hash, kind) ?? findOrIndexClassSymbol(id);
    return symbol;
}

/** Enumerates all global objects, including the chain linked objects. */
export function* enumerateObjects(): Generator<UCObjectSymbol, UCObjectSymbol[]> {
    for (const symbol of ObjectsTable.enumerate()) {
        for (let next = symbol.nextInHash; next; next = next.nextInHash) {
            yield next;
        }
        yield symbol;
    }

    return [];
}