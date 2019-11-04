import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { intersectsWith } from '../helpers';
import { UCDocument } from '../document';
import { UCBlock } from '../statements';
import { Name } from '../names';
import { SymbolWalker } from '../symbolWalker';

import {
	ISymbol, ISymbolContainer,
	UCFieldSymbol,
	UCSymbol, ITypeSymbol
} from ".";

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISymbol> {
	public extendsType?: ITypeSymbol;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;
	public block?: UCBlock;

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Module;
	}

	getCompletionSymbols(document: UCDocument, _context: string) {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}

		let parent = this.super || this.outer as UCStructSymbol;
		for (; parent; parent = parent.super || parent.outer as UCStructSymbol) {
			for (let child = parent.children; child; child = child.next) {
				if (child.acceptCompletion(document, this)) {
					symbols.push(child);
				}
			}
		}
		return symbols;
	}

	getCompletionContext(position: Position) {
		for (let symbol = this.children; symbol; symbol = symbol.next) {
			if (intersectsWith(symbol.getRange(), position)) {
				return symbol.getCompletionContext(position);
			}
		}
		return this;
	}

	getContainedSymbolAtPos(position: Position) {
		let symbol: ISymbol | undefined;
		if (this.extendsType && (symbol = this.extendsType.getSymbolAtPos(position))) {
			return symbol;
		}

		if (this.block && (symbol = this.block.getSymbolAtPos(position))) {
			return symbol;
		}
		return this.getChildSymbolAtPos(position);
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

	addSymbol(symbol: UCFieldSymbol): Name | undefined {
		symbol.outer = this;
		symbol.next = this.children;
		symbol.containingStruct = this;
		this.children = symbol;
		// No key
		return undefined;
	}

	addAlias(key: Name, symbol: ISymbol) {
		throw 'not implemented';
	}

	getSymbol(id: Name, kind?: SymbolKind): UCSymbol | undefined {
		for (let child = this.children; child; child = child.next) {
			if (child.getId() === id) {
				if (kind !== undefined && (child.getTypeKind() & kind) === 0) {
					continue;
				}
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: Name, kind?: SymbolKind): UCSymbol | undefined {
		return this.getSymbol(id, kind) || this.super && this.super.findSuperSymbol(id, kind);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.extendsType) {
			this.extendsType.index(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsType.getReference() as UCStructSymbol;
			}
		}

		if (this.children) for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
			try {
				child.index(document, this);
			} catch (err) {
				console.error(`Encountered an error while indexing '${child.getQualifiedName()}': ${err}`);
			}
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitStruct(this);
	}
}

/**
 * Looks up the @struct's hierachy for a matching @id
 */
export function findSuperStruct(struct: UCStructSymbol, id: Name): UCStructSymbol | undefined {
	for (let other = struct.super; other; other = other.super) {
		if (other.getId() === id) {
			return other;
		}
	}
	return undefined;
}