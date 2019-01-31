import { Range, Position } from 'vscode-languageserver-types';

import { ISymbolId } from "./ISymbolId";
import { ISymbolSpan } from "./ISymbolSpan";
import { ISimpleSymbol } from './ISimpleSymbol';
import { UCSymbol, UCSymbolRef, UCStructSymbol } from './';

import { UCDocumentListener } from '../DocumentListener';
import { UnrecognizedTypeNode } from '../diagnostics/diagnostics';
import { UCTypeKind } from './UCTypeKind';

export class UCTypeRef extends UCSymbolRef {
	public InnerTypeRef?: UCTypeRef;

	constructor(id: ISymbolId, outer: ISimpleSymbol, private _expectingType?: UCTypeKind, private span?: ISymbolSpan) {
		super(id, outer);
	}

	getTooltip(): string {
		if (this.reference) {
			return this.InnerTypeRef
				? (this.reference.getQualifiedName() + `<${this.InnerTypeRef.getTooltip()}>`)
				: this.reference.getQualifiedName();
		}
		return this.getName();
	}

	getSpanRange(): Range {
		return this.span!.range;
	}

	isWithinPosition(position: Position) {
		const range = this.getSpanRange();
		if (position.line < range.start.line || position.line > range.end.line) {
			return false;
		}

		if (position.line == range.start.line) {
			return position.character >= range.start.character;
		}

		if (position.line == range.end.line) {
			return position.character <= range.end.character;
		}
		return false;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.span) {
			return super.getSymbolAtPos(position);
		}

		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}
			return this.getSubSymbolAtPos(position);
		}
		return undefined;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.InnerTypeRef) {
			return this.InnerTypeRef.getSymbolAtPos(position);
		}
		return undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		// console.assert(this.outer, 'No outer for type "' + this.getName() + '"');

		switch (this._expectingType) {
			case UCTypeKind.Class:
				this.linkToClass(document);
				break;

			default:
				const symbol = context.findTypeSymbol(this.getName().toLowerCase(), true);
				if (symbol) {
					this.setReference(symbol);
				} else {
					this.linkToClass(document);
				}
				break;
		}

		if (this.InnerTypeRef) {
			this.InnerTypeRef.link(document, context);
		}
	}

	private linkToClass(document: UCDocumentListener) {
		document.getDocument(this.getName().toLowerCase(), (classDocument => {
			if (classDocument && classDocument.class) {
				this.setReference(classDocument.class);
			} else {
				document.nodes.push(new UnrecognizedTypeNode(this));
			}
		}));
	}
}