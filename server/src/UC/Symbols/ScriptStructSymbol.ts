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