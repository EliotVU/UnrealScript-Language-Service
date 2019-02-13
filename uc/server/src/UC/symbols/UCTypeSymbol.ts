import { Range, Position } from 'vscode-languageserver-types';

import { ISymbolId } from "./ISymbolId";
import { ISymbolSpan } from "./ISymbolSpan";
import { UCSymbol, UCReferenceSymbol, UCStructSymbol } from '.';
import { UCTypeKind } from './UCTypeKind';

import { UCDocumentListener } from '../DocumentListener';
import { UnrecognizedTypeNode } from '../diagnostics/diagnostics';

export class UCTypeSymbol extends UCReferenceSymbol {
	public innerType?: UCTypeSymbol;

	constructor(id: ISymbolId, private _typeKind?: UCTypeKind, private span?: ISymbolSpan) {
		super(id);
	}

	getTooltip(): string {
		if (this.reference) {
			return this.innerType
				? (this.reference.getQualifiedName() + `<${this.innerType.getTooltip()}>`)
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
		if (this.innerType) {
			return this.innerType.getSymbolAtPos(position);
		}
		return undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		// console.assert(this.outer, 'No outer for type "' + this.getName() + '"');

		switch (this._typeKind) {
			case UCTypeKind.Class:
				this.linkToClass(document);
				break;

			default:
				const symbol = context.findTypeSymbol(this.getName().toLowerCase(), true);
				if (symbol) {
					this.setReference(symbol, document);
				} else {
					this.linkToClass(document);
				}
				break;
		}

		if (this.innerType) {
			this.innerType.link(document, context);
		}
	}

	private linkToClass(document: UCDocumentListener) {
		document.getDocument(this.getName().toLowerCase(), (classDocument => {
			if (classDocument && classDocument.class) {
				this.setReference(classDocument.class, document);
			} else {
				document.nodes.push(new UnrecognizedTypeNode(this));
			}
		}));
	}
}