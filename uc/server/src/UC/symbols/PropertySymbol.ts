import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';

import { UCSymbol, UCTypeSymbol, UCFieldSymbol, UCStructSymbol } from '.';
import { SymbolVisitor } from '../SymbolVisitor';

export class UCPropertySymbol extends UCFieldSymbol {
	public type?: UCTypeSymbol;

	// Array dimension if specified, string may represent a number or a qualified identifier e.g. a const.
	public arrayDim?: string;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTypeTooltip() {
		return 'var';
	}

	getTooltip() {
		return `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getQualifiedName()}`;
	}

	getContainedSymbolAtPos(position: Position) {
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

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitProperty(this);
	}
}