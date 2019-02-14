import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCEnumSymbol, UCFieldSymbol, UCScriptStructSymbol, UCSymbol, UCTypeSymbol, CORE_PACKAGE } from "./";
import { UCDocumentListener } from '../DocumentListener';
import { CommonTokenStream } from 'antlr4ts';
import { COMMENT_TYPES } from './UCSymbol';

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISymbol> {
	public extendsType?: UCTypeSymbol;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;

	public types?: Map<string, UCFieldSymbol>;

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
			if (child.getName().toLowerCase() === id) {
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: string): UCSymbol | undefined {
		for (let superSymbol: UCStructSymbol = this; superSymbol; superSymbol = superSymbol.super) {
			const symbol = superSymbol.findSymbol(id);
			if (symbol) {
				return symbol;
			}
		}
		return undefined;
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): ISymbol | undefined {
		if (qualifiedId === this.getName().toLowerCase()) {
			return this;
		}

		// Quick shortcut for the most common types or top level symbols.
		const predefinedType: ISymbol = CORE_PACKAGE.findQualifiedSymbol(qualifiedId, false);
		if (predefinedType) {
			return predefinedType;
		}

		if (this.types) {
			const typeSymbol = this.types.get(qualifiedId);
			if (typeSymbol) {
				return typeSymbol;
			}
		}

		if (!deepSearch) {
			return undefined;
		}

		if (this.super) {
			return this.super.findTypeSymbol(qualifiedId, deepSearch);
		}
		return this.outer && this.outer instanceof UCStructSymbol
			? this.outer.findTypeSymbol(qualifiedId, deepSearch)
			: undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsType) {
			this.extendsType.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsType.getReference() as UCStructSymbol;
			}
		}

		if (!this.children) {
			return;
		}

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

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsType) {
			this.extendsType.analyze(document, context);
		}

		for (let child = this.children; child; child = child.next) {
			child.analyze(document, this);
		}
	}
}