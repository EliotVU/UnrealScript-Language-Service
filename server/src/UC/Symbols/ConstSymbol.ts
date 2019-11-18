import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { UCLiteral, IExpression } from '../expressions';
import { UCDocument } from '../document';
import { UCFieldSymbol, UCStructSymbol, UCTypeFlags } from ".";

export class UCConstSymbol extends UCFieldSymbol {
	public expression?: IExpression;

	getComputedValue(): number | undefined {
		return this.expression instanceof UCLiteral
			? this.expression.getValue()
			: undefined;
	}

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getTypeFlags() {
		return UCTypeFlags.Const;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		const text = 'const ' + this.getQualifiedName();
		if (this.expression) {
			return text + ' = ' + (this.getComputedValue() || this.expression.toString());
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
