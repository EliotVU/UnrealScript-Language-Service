import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { intersectsWith } from '../helpers';
import { UCDocument } from '../document';
import { UCBlock } from '../statements';
import { Name } from '../names';

import {
	ISymbol, ISymbolContainer,
	UCFieldSymbol, UCPropertySymbol,
	UCMethodSymbol,
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

	getCompletionSymbols(document: UCDocument) {
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

		if (this.block) {
			const symbol = this.block.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
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

	getSymbol(id: Name): UCSymbol | undefined {
		for (let child = this.children; child; child = child.next) {
			if (child.getId() === id) {
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: Name): UCSymbol | undefined {
		return this.getSymbol(id) || this.super && this.super.findSuperSymbol(id);
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

		// FIXME: Optimize. We have to index types before anything else but properties ALSO have to be indexed before any method can be indexed properly!
		if (this.children) {
			// Link types before any child so that a child that referrers one of our types can be linked properly!
			for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
				if (child.isType()) {
					child.index(document, this);
				}
			}

			// Index all properties foremost as we need their resolved types.
			for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
				if (child instanceof UCPropertySymbol) {
					child.index(document, this);
				}
			}

			for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
				if (child instanceof UCMethodSymbol) {
					child.index(document, this);
				}
			}

			for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
				if (child.isType() || child instanceof UCPropertySymbol || child instanceof UCMethodSymbol) {
					continue;
				}

				child.index(document, this);
			}

			for (let child: undefined | UCFieldSymbol = this.children; child; child = child.next) {
				if (child instanceof UCStructSymbol && child.block) {
					child.block.index(document, child);
				}
			}
		}
	}
}