import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { ModifierFlags, UCFieldSymbol, UCTypeFlags } from './';

export class UCEnumMemberSymbol extends UCFieldSymbol {
	override modifiers = ModifierFlags.ReadOnly;

	// Unrealscript only supports (automatic) byte values.
	public value: number;

	override getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	override getTypeFlags() {
		return UCTypeFlags.Byte;
	}

	override getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.EnumMember;
	}

	protected override getTypeKeyword(): string {
        if (this.modifiers & ModifierFlags.Intrinsic) {
            return '(intrinsic enum member)';
        }
        if (this.modifiers & ModifierFlags.Generated) {
            return '(generated enum member)';
        }
		return '(enum member)';
	}

	override getTooltip(): string {
        return `${this.getTypeKeyword()} ${this.getPath()} = ${this.value}`;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitEnumMember(this);
	}
}