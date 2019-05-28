import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';

import { UCStructSymbol, ISymbol } from '.';
import { SymbolWalker } from '../symbolWalker';

export class UCEnumSymbol extends UCStructSymbol {
	isProtected(): boolean {
		return true;
	}

	isType(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getQualifiedName()}`;
	}

	getCompletionSymbols(document: UCDocument): ISymbol[] {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}
		return symbols;
	}


	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitEnum(this);
	}
}