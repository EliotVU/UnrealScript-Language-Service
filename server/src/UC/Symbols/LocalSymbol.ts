import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCPropertySymbol } from './';
import { ModifierFlags } from './FieldSymbol';

export class UCLocalSymbol extends UCPropertySymbol {
    override modifiers = ModifierFlags.Local;

	override getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	override getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	protected override getTypeKeyword(): string {
		return 'local';
	}

	protected override getTooltipId(): string {
		return this.getName().text;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitLocal(this);
	}
}