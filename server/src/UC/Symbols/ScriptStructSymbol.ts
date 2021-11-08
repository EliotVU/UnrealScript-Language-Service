import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import {
    ISymbol, UCMethodSymbol, UCPropertySymbol, UCStructSymbol, UCSymbol, UCTypeFlags
} from './';

export class UCScriptStructSymbol extends UCStructSymbol {
	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	getTypeFlags() {
		return UCTypeFlags.Struct;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Struct;
	}

	getTooltip(): string {
		return `struct ${this.getPath()}`;
	}

    getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: string, type?: UCTypeFlags) {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (typeof type !== 'undefined' && (child.getTypeFlags() & type) === 0) {
				continue;
			}
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}

		for (let parent = this.super; parent; parent = parent.super) {
            if ((parent.getTypeFlags() & UCTypeFlags.Struct) === 0) {
                break;
            }

			for (let child = parent.children; child; child = child.next) {
				if (typeof type !== 'undefined' && (child.getTypeFlags() & type) === 0) {
					continue;
				}
				if (child.acceptCompletion(document, this)) {
					symbols.push(child);
				}
			}
		}
		return symbols as C[];
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return (context instanceof UCPropertySymbol || context instanceof UCMethodSymbol);
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		super.index(document, this);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitScriptStruct(this);
	}
}