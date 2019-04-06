import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';

import { UCSymbol, UCTypeSymbol, UCFieldSymbol, UCStructSymbol } from '.';

export class UCPropertySymbol extends UCFieldSymbol {
	public type: UCTypeSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTypeTooltip(): string {
		return 'var';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getQualifiedName()}`;
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.type) {
			return this.type.getSymbolAtPos(position);
		}
		return undefined;
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.type) {
			this.type.index(document, context);
		}
	}

	public analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.type) {
			this.type.analyze(document, context);
		}
	}
}