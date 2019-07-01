import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { IExpression } from '../expressions';
import { UCDocument } from '../document';
import { UCPropertySymbol, UCStructSymbol } from '.';

export class UCParamSymbol extends UCPropertySymbol {
	defaultExpression?: IExpression;

	isPrivate(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	protected getTypeKeyword(): string {
		return '(parameter)';
	}

	protected getTooltipId(): string {
		return this.getId().toString();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.defaultExpression && this.defaultExpression.getSymbolAtPos(position);
		return symbol || super.getContainedSymbolAtPos(position);
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.defaultExpression && this.defaultExpression.index(document, context);
	}

	public analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.defaultExpression && this.defaultExpression.analyze(document, context);
	}

	protected buildModifiers(): string[] {
		const text: string[] = [];

		if (this.isConst()) {
			text.push('const');
		}

		return text;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitParameter(this);
	}
}