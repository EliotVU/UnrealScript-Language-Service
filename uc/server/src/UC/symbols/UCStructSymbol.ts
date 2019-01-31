import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCEnumSymbol, UCFieldSymbol, UCScriptStructSymbol, UCSymbol, UCTypeSymbol, CORE_PACKAGE } from "./";
import { UCDocumentListener } from '../DocumentListener';

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

	findTypeSymbol(idLowerCase: string, deepSearch: boolean): ISymbol | undefined {
		// Quick shortcut for the most common types or top level symbols.
		var predefinedType: ISymbol = CORE_PACKAGE.findQualifiedSymbol(idLowerCase, false);
		if (predefinedType) {
			return predefinedType;
		}

		if (this.types) {
			const typeSymbol = this.types.get(idLowerCase);
			if (typeSymbol) {
				return typeSymbol;
			}
		}

		if (!deepSearch) {
			return undefined;
		}

		if (this.super) {
			return this.super.findTypeSymbol(idLowerCase, deepSearch);
		}
		return undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsType) {
			this.extendsType.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsType.getReference() as UCStructSymbol;
			}
		}

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

	analyze(document: UCDocumentListener, _context: UCStructSymbol) {
		if (this.types) {
			for (let type of this.types.values()) {
				type.analyze(document, this);
			}
		}

		for (let child = this.children; child; child = child.next) {
			if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
				continue;
			}

			child.analyze(document, this);
		}
	}
}