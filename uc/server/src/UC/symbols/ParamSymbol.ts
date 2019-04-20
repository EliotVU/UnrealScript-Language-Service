import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCPropertySymbol } from '.';
import { SymbolVisitor } from '../SymbolVisitor';

export class UCParamSymbol extends UCPropertySymbol {
	isPrivate(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTypeTooltip(): string {
		return '(parameter)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getName()}`;
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitParameter(this);
	}
}