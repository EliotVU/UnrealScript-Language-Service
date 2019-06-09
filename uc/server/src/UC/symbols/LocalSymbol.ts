import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCPropertySymbol } from '.';

export class UCLocalSymbol extends UCPropertySymbol {
	isPrivate(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTypeTooltip(): string {
		return 'local';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getName()}`;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitLocal(this);
	}
}