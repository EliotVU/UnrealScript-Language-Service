import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCTypeFlags } from './';

export class UCEnumMemberSymbol extends UCFieldSymbol {
	// Unrealscript only supports (automatic) byte values.
	public value!: number;

	getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	getTypeFlags() {
		return UCTypeFlags.Byte;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.EnumMember;
	}

	protected getTypeKeyword(): string {
		return '(enum member)';
	}

	getTooltip(): string {
		return `${this.getTypeKeyword()} ${this.getPath()} = ${this.value}`;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitEnumMember(this);
	}
}