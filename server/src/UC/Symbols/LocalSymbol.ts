import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCPropertySymbol } from './';

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

	protected getTypeKeyword(): string {
		return 'local';
	}

	protected getTooltipId(): string {
		return this.getName().toString();
	}

	protected buildModifiers(): string[] {
		const text: string[] = [];

		// no known modifiers of interest to us here.

		return text;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitLocal(this);
	}
}