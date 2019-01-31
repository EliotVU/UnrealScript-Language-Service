import { Range, Position } from 'vscode-languageserver-types';

import { UCSymbol } from './';
import { ISymbolId } from "./ISymbolId";
import { ISymbolSpan } from "./ISymbolSpan";

export class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;

	constructor(id: ISymbolId, private span: ISymbolSpan) {
		super(id);
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getSpanRange(): Range {
		return this.span.range;
	}

	isWithinPosition(position: Position) {
		var range = this.getSpanRange();
		var isInRange = position.line >= range.start.line && position.line <= range.end.line;
		if (isInRange) {
			if (position.line == range.start.line) {
				return position.character >= range.start.character;
			}

			if (position.line == range.end.line) {
				return position.character <= range.end.character;
			}
		}
		return isInRange;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.isWithinPosition(position)) {
			return undefined;
		}

		if (this.isIdWithinPosition(position)) {
			return this;
		}
		return this.getSubSymbolAtPos(position);
	}
}