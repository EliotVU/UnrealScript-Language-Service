import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol, UCTypeSymbol, UCFieldSymbol, UCStructSymbol } from './';
import { UCDocumentListener } from '../DocumentListener';

export class UCPropertySymbol extends UCFieldSymbol {
	public type: UCTypeSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTypeTooltip(): string {
		return '(variable)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getQualifiedName()}`;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.type) {
			return this.type.getSymbolAtPos(position);
		}
		return undefined;
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.type) {
			this.type.link(document, context);
		}
	}

	public analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.type) {
			this.type.analyze(document, context);
		}
	}
}