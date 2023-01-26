import { SymbolWalker } from '../symbolWalker';
import { ModifierFlags, UCPropertySymbol, UCSymbolKind } from './';

export class UCLocalSymbol extends UCPropertySymbol {
    override kind = UCSymbolKind.Local;
    override modifiers = ModifierFlags.Local;

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