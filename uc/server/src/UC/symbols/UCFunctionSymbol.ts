import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol } from './UCSymbol';
import { UCDocumentListener } from '../DocumentListener';
import { UCSymbolRef } from "./UCSymbolRef";
import { UCStructSymbol } from "./UCStructSymbol";
import { UCPropertySymbol } from "./UCPropertySymbol";

export class UCFunctionSymbol extends UCStructSymbol {
	public returnTypeRef?: UCSymbolRef;
	public params: UCPropertySymbol[] = [];

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
		if (this.returnTypeRef && this.returnTypeRef.getSymbolAtPos(position)) {
			return this.returnTypeRef;
		}
		return super.getSubSymbolAtPos(position);
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);

		if (this.returnTypeRef) {
			this.returnTypeRef.link(document, context);
		}
	}

	private buildReturnType(): string {
		return this.returnTypeRef ? this.returnTypeRef.getName() + ' ' : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}
}