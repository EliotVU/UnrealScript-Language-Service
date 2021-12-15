import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { IExpression } from '../expressions';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCStructSymbol, UCTypeFlags } from './';
import { FieldModifiers } from './FieldSymbol';

export class UCConstSymbol extends UCFieldSymbol {
    modifiers = FieldModifiers.ReadOnly;

	public expression?: IExpression;

	getComputedValue(): number | undefined {
		return this.expression?.getValue();
	}

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

    getType() {
        return this.expression?.getType();
    }

	getTypeFlags() {
		return UCTypeFlags.Const;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		const text = `const ${this.getPath()}`;
        const value = this.getComputedValue();
        if (typeof value === 'number') {
            return `${text} = ${this.getComputedValue()}`;
        }
		return text;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.expression?.getSymbolAtPos(position) || super.getContainedSymbolAtPos(position);
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.expression?.index(document, context);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitConst(this);
	}
}
