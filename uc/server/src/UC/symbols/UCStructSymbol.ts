import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCSymbol } from './UCSymbol';
import { UCDocumentListener } from '../DocumentListener';
import { CORE_PACKAGE } from './NativeSymbols';
import { UCTypeRef } from './UCTypeRef';
import { UCScriptStructSymbol } from "./UCScriptStructSymbol";
import { UCEnumSymbol } from "./UCEnumSymbol";
import { UCFieldSymbol } from "./UCFieldSymbol";

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISimpleSymbol> {
	public extendsRef?: UCTypeRef;
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
		if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
			return this.extendsRef;
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
		id = id.toLowerCase();
		for (let child = this.children; child; child = child.next) {
			if (child.getName().toLowerCase() === id) {
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: string, deepSearch?: boolean): UCSymbol | undefined {
		for (let superSymbol: UCStructSymbol = this; superSymbol; superSymbol = superSymbol.super) {
			const symbol = superSymbol.findSymbol(id);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
		return undefined;
	}

	findTypeSymbol(idLowerCase: string, deepSearch: boolean): ISimpleSymbol | undefined {
		// Quick shortcut for the most common types.
		var predefinedType: ISimpleSymbol = CORE_PACKAGE.findQualifiedSymbol(idLowerCase, false);
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

		return super.findTypeSymbol(idLowerCase, deepSearch);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsRef) {
			this.extendsRef.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsRef.getReference() as UCStructSymbol;
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