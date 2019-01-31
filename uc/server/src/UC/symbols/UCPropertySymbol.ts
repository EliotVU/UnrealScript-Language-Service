import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol } from './UCSymbol';
import { UCDocumentListener } from '../DocumentListener';
import { UCTypeRef } from './UCTypeRef';
import { UCFieldSymbol } from "./UCFieldSymbol";
import { UCStructSymbol } from "./UCStructSymbol";

export class UCPropertySymbol extends UCFieldSymbol {
	public typeRef: UCTypeRef;

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
		return `${this.getTypeTooltip()} ${this.getTypeText()} ${this.getQualifiedName()}`;
	}

	getTypeText(): string {
		return this.typeRef!.getName();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.typeRef) {
			return this.typeRef.getSymbolAtPos(position);
		}
		return undefined;
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document);

		if (this.typeRef) {
			this.typeRef.link(document, context);
		}
	}
}
