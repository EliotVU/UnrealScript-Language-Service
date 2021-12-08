import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { ISymbol, UCStructSymbol, UCTypeFlags } from './';

export class UCEnumSymbol extends UCStructSymbol {
    public maxValue: number;

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getTypeFlags() {
		return UCTypeFlags.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getPath()}`;
	}

	getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: string, _kind?: UCTypeFlags): C[] {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}
		return symbols as C[];
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitEnum(this);
	}
}