import { Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { IExpression } from '../expressions';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCStructSymbol, UCSymbolKind, UCTypeKind } from './';
import { ModifierFlags } from './ModifierFlags';

export class UCConstSymbol extends UCFieldSymbol {
    override kind = UCSymbolKind.Const;
    override modifiers = ModifierFlags.ReadOnly;

	public expression?: IExpression;

	getComputedValue(): number | boolean | string | undefined {
		return this.expression?.getValue();
	}

    override getType() {
        return this.expression?.getType();
    }

	override getTypeKind() {
		return UCTypeKind.Object;
	}

	override getTooltip(): string {
		const text = `const ${this.getPath()}`;
        const value = this.getComputedValue();
        if (typeof value !== 'undefined') {
            return `${text} = ${value}`;
        }
		return text;
	}

	override getContainedSymbolAtPos(position: Position) {
		return this.expression?.getSymbolAtPos(position) ?? super.getContainedSymbolAtPos(position);
	}

	override index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

        // No type, enums are not visible in a constant assignment.
		this.expression?.index(document, context, { contextType: undefined });
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitConst(this);
	}
}
