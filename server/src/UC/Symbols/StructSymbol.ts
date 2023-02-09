import { Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith } from '../helpers';
import { Name } from '../name';
import { UCBlock } from '../statements';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextKind,
    Identifier,
    isFunction,
    isOperator,
    isStateSymbol,
    ISymbol,
    ISymbolContainer,
    UCBaseOperatorSymbol,
    UCFieldSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCQualifiedTypeSymbol,
    UCSymbolKind,
} from './';

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<UCObjectSymbol> {
	public extendsType?: UCObjectTypeSymbol | UCQualifiedTypeSymbol;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;
    // TODO: Map operators by param types
	public operators?: UCFieldSymbol;
	public block?: UCBlock;
    public labels?: { [key: number]: Identifier };

	override getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: ContextKind, kinds?: UCSymbolKind) {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (typeof kinds !== 'undefined' && ((1 << child.kind) & kinds) === 0) {
				continue;
			}
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}

		let parent: UCStructSymbol | undefined = this.super ?? this.outer as UCStructSymbol;
		for (; parent; parent = parent.super ?? parent.outer as UCStructSymbol) {
			for (let child = parent.children; child; child = child.next) {
				if (typeof kinds !== 'undefined' && ((1 << child.kind) & kinds) === 0) {
					continue;
				}
				if (child.acceptCompletion(document, this)) {
					symbols.push(child);
				}
			}
		}
		return symbols as C[];
	}

	override getCompletionContext(position: Position) {
		for (let symbol = this.children; symbol; symbol = symbol.next) {
			if (intersectsWith(symbol.getRange(), position)) {
				const context = symbol.getCompletionContext(position);
				if (context) {
					return context;
				}
			}
		}
		return this;
	}

	override getContainedSymbolAtPos(position: Position) {
		return this.extendsType?.getSymbolAtPos(position)
			?? this.block?.getSymbolAtPos(position)
			?? this.getChildSymbolAtPos(position);
	}

	getChildSymbolAtPos(position: Position) {
		for (let child = this.children; child; child = child.next) {
			const innerSymbol = child.getSymbolAtPos(position);
			if (innerSymbol) {
				return innerSymbol;
			}
		}
		return undefined;
	}

    addLabel(label: Identifier): void {
        if (typeof this.labels === 'undefined') {
            this.labels = Object.create(null);
        }
        this.labels![label.name.hash] = label;
    }

    childrenCount(): number {
        let l = 0;
        for (let child = this.children; child; child = child.next) {
            ++l;
        }
        return l;
    }

	addSymbol(symbol: UCFieldSymbol): number | undefined {
		symbol.outer = this;
		symbol.next = this.children;
		this.children = symbol;
        if (isOperator(symbol)) {
            this.operators = symbol;
        }
		// No key
		return undefined;
	}

    removeSymbol(symbol: UCFieldSymbol) {
        if (this.children === symbol) {
            this.children = symbol.next;
            symbol.next = undefined;
            return;
        }

        for (let child = this.children; child; child = child.next) {
			if (child.next === symbol) {
                child.next = symbol.next;
                break;
			}
		}
    }

	getSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind): T | undefined {
		for (let child = this.children; child; child = child.next) {
			if (child.id.name === id) {
				if (kind !== undefined && child.kind !== kind) {
					break;
				}
				return child as T;
			}
		}
		return undefined;
	}

    findSymbolPredicate<T extends UCFieldSymbol>(predicate: (symbol: UCFieldSymbol) => boolean): T | undefined {
		for (let child = this.children; child; child = child.next) {
            if (predicate(child)) {
                return child as T;
            }
		}
		return undefined;
	}


	findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind): T | undefined {
		return this.getSymbol<T>(id, kind) ?? this.super?.findSuperSymbol(id, kind);
	}

	override index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
        this.indexSuper(document, context);
        this.indexChildren(document);
	}

    protected indexSuper(document: UCDocument, context: UCStructSymbol) {
		if (this.extendsType && this.extendsType.id.name !== this.id.name) {
			this.extendsType.index(document, context);
            this.super ??= this.extendsType.getRef<UCStructSymbol>();
		}
    }

    protected indexChildren(document: UCDocument) {
        if (this.children) for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
			try {
				child.index(document, this);
			} catch (err) {
				console.error(`Encountered an error while indexing '${child.getPath()}': ${err}`);
			}
		}
    }

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitStruct(this);
	}
}

/**
 * Looks up the @struct's hierarchy for a matching @id
 */
export function findSuperStruct(context: UCStructSymbol, id: Name): UCStructSymbol | undefined {
	for (let other = context.super; other; other = other.super) {
		if (other.id.name === id) {
			return other;
		}
	}
	return undefined;
}

export function findOverloadedOperator<T extends UCBaseOperatorSymbol>(
    context: UCStructSymbol,
    id: Name,
    predicate: (symbol: T) => boolean
): T | undefined {
    let scope: UCStructSymbol | undefined = isFunction(context)
        ? context.outer as UCStructSymbol
        : context;

    // FIXME: SLOW, we need to cache a state of operators
    const operators: T[] = [];
    for (; scope; scope = isStateSymbol(scope)
        ? scope.outer as UCStructSymbol
        : scope.super) {
        for (let child = scope.operators; child; child = child.next) {
            if (!isOperator(child)) {
                continue;
            }

            if (child.id.name === id) {
                operators.push(child as T);
            }
        }
    }

    // It is crucial to overload in the reverse order.
    for (let i = operators.length - 1; i >= 0; --i) {
        if (predicate(operators[i])) {
            return operators[i];
        }
    }

    return undefined;
}