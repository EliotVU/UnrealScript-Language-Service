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
		const text = 'const ' + this.getPath();
		if (this.expression) {
			return text + ' = ' + (this.getComputedValue() ?? this.expression.toString());
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

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitConst(this);
	}
}
