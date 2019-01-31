import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCSymbol } from './';

export class UCEnumMemberSymbol extends UCSymbol {
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
		return `${this.getTypeTooltip()} ${this.getQualifiedName()}`;
	}
}