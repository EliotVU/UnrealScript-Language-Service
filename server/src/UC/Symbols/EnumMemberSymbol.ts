import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCSymbolKind, UCTypeKind } from './';
import { ModifierFlags } from './ModifierFlags';

export class UCEnumMemberSymbol extends UCFieldSymbol {
    override kind = UCSymbolKind.EnumTag;
	override modifiers = ModifierFlags.ReadOnly;

	// Unrealscript only supports (automatic) byte values.
	public value: number;

	override getTypeKind() {
		return UCTypeKind.Byte;
	}

    protected override getTypeHint(): string {
        if (this.modifiers & ModifierFlags.Intrinsic) {
			return '(intrinsic enum tag)';
		}

        if (this.modifiers & ModifierFlags.Generated) {
            return '(generated enum tag)';
        }
        return '(enum tag)';
    }

	protected override getTypeKeyword(): string {
		return this.getTypeHint();
	}

	override getTooltip(): string {
        return `${this.getTypeKeyword()} ${this.getPath()} = ${this.value}`;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitEnumMember(this);
	}
}
