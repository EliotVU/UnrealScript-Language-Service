import { Position } from 'vscode-languageserver-types';

import { IExpression } from '../expressions';
import { SymbolWalker } from '../symbolWalker';
import { ModifierFlags, UCPropertySymbol, UCSymbolKind } from './';

export class UCParamSymbol extends UCPropertySymbol {
    override kind = UCSymbolKind.Parameter;
	override modifiers: ModifierFlags = ModifierFlags.Param;

	public defaultExpression?: IExpression;

	getTextForSignature(): string {
		const text: Array<string | undefined> = [];

		const modifiers = this.buildModifiers();
		text.push(...modifiers);
		if (this.type) {
			text.push(this.type.getTypeText());
		}
		text.push(this.getName().text);

		return text.filter(s => s).join(' ');
	}

	getTextForReturnValue(): string {
		const text: Array<string | undefined> = [];
		if (this.modifiers & ModifierFlags.Coerce) {
			text.push('coerce');
		}
		if (this.type) {
			text.push(this.type.getTypeText());
		}
		return text.filter(s => s).join(' ');
	}

	protected override getTypeKeyword(): string {
		return '(parameter)';
	}

	protected override getTooltipId(): string {
		return this.getName().text;
	}

	override getContainedSymbolAtPos(position: Position) {
		const symbol = this.defaultExpression?.getSymbolAtPos(position) ?? super.getContainedSymbolAtPos(position);
		return symbol;
	}

	override buildModifiers(modifiers = this.modifiers): string[] {
		const text: string[] = super.buildModifiers(modifiers);

		if (modifiers & ModifierFlags.Optional) {
			text.push('optional');
		}

		if (modifiers & ModifierFlags.Out) {
			text.push('out');
		}

		if (modifiers & ModifierFlags.Coerce) {
			text.push('coerce');
		}

		if (modifiers & ModifierFlags.Ref) {
			text.push('ref');
		}

		return text;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitParameter(this);
	}
}