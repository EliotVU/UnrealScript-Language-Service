import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { FieldModifiers, UCFieldSymbol, UCTypeFlags } from './';

export class UCEnumMemberSymbol extends UCFieldSymbol {
	modifiers = FieldModifiers.ReadOnly;

	// Unrealscript only supports (automatic) byte values.
	public value: number;

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
        if (this.modifiers & FieldModifiers.Intrinsic) {
            return '(intrinsic enum member)';
        }
        if (this.modifiers & FieldModifiers.Generated) {
            return '(generated enum member)';
        }
		return '(enum member)';
	}

	getTooltip(): string {
        return `${this.getTypeKeyword()} ${this.getPath()} = ${this.value}`;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitEnumMember(this);
	}
}