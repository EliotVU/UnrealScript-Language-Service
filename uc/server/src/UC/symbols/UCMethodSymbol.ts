import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol, UCTypeSymbol, UCStructSymbol, UCParamSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

export class UCMethodSymbol extends UCStructSymbol {
	public returnType?: UCTypeSymbol;
	public params: UCParamSymbol[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTypeTooltip(): string {
		return '(method)';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + ' ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.returnType && this.returnType.getSymbolAtPos(position)) {
			return this.returnType;
		}
		return super.getSubSymbolAtPos(position);
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);

		if (this.returnType) {
			this.returnType.link(document, context);
		}
	}

	private buildReturnType(): string {
		return this.returnType ? this.returnType.getName() + ' ' : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}
}