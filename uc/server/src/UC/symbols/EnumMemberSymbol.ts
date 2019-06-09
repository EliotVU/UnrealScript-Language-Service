import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol } from '.';

export class UCEnumMemberSymbol extends UCFieldSymbol {
	// Unrealscript only supports (automatic) byte values.
	public value: number;

	getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.EnumMember;
	}

	getTypeTooltip(): string {
		return '(enum member)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.getQualifiedName()} = ${this.value}`;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitEnumMember(this);
	}
}