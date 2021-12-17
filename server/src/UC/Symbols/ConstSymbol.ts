import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { IExpression } from '../expressions';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCStructSymbol, UCTypeFlags } from './';
import { ModifierFlags } from './FieldSymbol';

export class UCConstSymbol extends UCFieldSymbol {
    override modifiers = ModifierFlags.ReadOnly;

	public expression?: IExpression;

	getComputedValue(): number | undefined {
		return this.expression?.getValue();
	}

	override getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

    override getType() {
        return this.expression?.getType();
    }

	override getTypeFlags() {
		return UCTypeFlags.Const;
	}

	override getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	override getTooltip(): string {
		const text = `const ${this.getPath()}`;
        const value = this.getComputedValue();
        if (typeof value === 'number') {
            return `${text} = ${this.getComputedValue()}`;
        }
		return text;
	}

	override getContainedSymbolAtPos(position: Position) {
		return this.expression?.getSymbolAtPos(position) || super.getContainedSymbolAtPos(position);
	}

	override index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.expression?.index(document, context);
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitConst(this);
	}
}
