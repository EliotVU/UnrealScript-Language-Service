import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocumentListener } from '../DocumentListener';
import { ISymbol } from './ISymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCEnumSymbol, UCFieldSymbol, UCScriptStructSymbol, UCSymbol, UCTypeSymbol, CORE_PACKAGE, UCMethodSymbol, UCStateSymbol } from "./";
import { UCScriptBlock } from './Statements';

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISymbol> {
	public extendsType?: UCTypeSymbol;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;

	public types?: Map<string, UCFieldSymbol>;

	public scriptBlock?: UCScriptBlock;

	private cachedTypeResolves = new Map<string, ISymbol>();

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Module;
	}

	getContextSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.intersectsWith(position)) {
			return this;
		}

		for (let symbol = this.children; symbol; symbol = symbol.next) {
			if (symbol instanceof UCStructSymbol) {
				const subSymbol = symbol.getContextSymbolAtPos(position);
				if (subSymbol) {
					return subSymbol;
				}
				continue;
			}

			if (symbol.intersectsWith(position)) {
				return symbol;
			}
		}
		return undefined;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.extendsType && this.extendsType.getSymbolAtPos(position)) {
			return this.extendsType;
		}

		if (this.scriptBlock) {
			const symbol = this.scriptBlock.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		return this.getChildSymbolAtPos(position);
	}

	getChildSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let child = this.children; child; child = child.next) {
			const innerSymbol = child.getSymbolAtPos(position);
			if (innerSymbol) {
				return innerSymbol;
			}
		}
		return undefined;
	}

	addSymbol(symbol: UCFieldSymbol) {
		symbol.outer = this;
		symbol.next = this.children;
		this.children = symbol;

		if (symbol instanceof UCScriptStructSymbol || symbol instanceof UCEnumSymbol) {
			if (!this.types) {
				this.types = new Map();
			}
			this.types.set(symbol.getName().toLowerCase(), symbol);
		}
	}

	findSymbol(id: string): UCSymbol | undefined {
		for (let child = this.children; child; child = child.next) {
			const name = child.getName().toLowerCase();
			if (name === id) {
				return child;
			}

			// Also match enum members
			if (child instanceof UCEnumSymbol) {
				const symbol = child.findSymbol(id);
				if (symbol) {
					return symbol;
				}
			}
		}
		return undefined;
	}

	findSuperSymbol(id: string): UCSymbol | undefined {
		if (id === this.getName().toLowerCase()) {
			return this;
		}

		let symbol = this.findSymbol(id);
		if (symbol) {
			return symbol;
		}

		// FIXME: Disable for methods?
		if (this.super && !(this instanceof UCMethodSymbol)) {
			symbol = this.super.findSuperSymbol(id);
			if (symbol) {
				return symbol;
			}
		}

		// Check for symbols in the outer of a function or state.
		if ((this instanceof UCMethodSymbol || this instanceof UCStateSymbol) && this.outer && this.outer instanceof UCStructSymbol) {
			return this.outer.findSuperSymbol(id);
		}
		return undefined;
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): ISymbol | undefined {
		let symbol = this.cachedTypeResolves.get(qualifiedId);
		if (symbol) {
			return symbol;
		}

		if (qualifiedId === this.getName().toLowerCase()) {
			return this;
		}

		// Quick shortcut for the most common types or top level symbols.
		symbol = CORE_PACKAGE.findQualifiedSymbol(qualifiedId, false);
		if (symbol) {
			return symbol;
		}

		if (this.types) {
			symbol = this.types.get(qualifiedId);
			if (symbol) {
				return symbol;
			}
		}

		if (!deepSearch) {
			return undefined;
		}

		if (this.super) {
			symbol = this.super.findTypeSymbol(qualifiedId, deepSearch);
		} else if (this.outer && this.outer instanceof UCStructSymbol) {
			symbol = this.outer.findTypeSymbol(qualifiedId, deepSearch);
		}

		if (symbol) {
			this.cachedTypeResolves.set(qualifiedId, symbol);
		}
		return symbol;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsType) {
			this.extendsType.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsType.getReference() as UCStructSymbol;
			}
		}

		if (this.children) {
			// Link types before any child so that a child that referes one of our types can be linked properly!
			if (this.types) {
				for (let type of this.types.values()) {
					type.link(document, this);
				}
			}

			for (let child = this.children; child; child = child.next) {
				if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
					continue;
				}

				child.link(document, this);
			}
		}

		if (this.scriptBlock) this.scriptBlock.link(document, this);
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsType) {
			this.extendsType.analyze(document, context);
		}

		for (let child = this.children; child; child = child.next) {
			child.analyze(document, this);
		}

		if (this.scriptBlock) this.scriptBlock.analyze(document, this);
	}
}