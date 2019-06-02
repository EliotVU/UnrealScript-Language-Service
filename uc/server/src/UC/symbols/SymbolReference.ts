import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';

import { ISymbol, ISymbolReference, ISymbolContext, IWithReference } from './ISymbol';
import { UCSymbol } from '.';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolReference extends UCSymbol implements IWithReference {
	protected reference?: ISymbol;

	// Redirect name to our resolved reference, so that e.g. 'obJeCT' resolves to the properly declared name 'Object'.
	getName(): string {
		return this.reference
			? this.reference.getName()
			: this.id.name;
	}

	getQualifiedName(): string {
		if (this.reference) {
			return this.reference.getQualifiedName();
		}
		return this.id.name;
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}

		const symbol = this.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (intersectsWithRange(position, this.id.range)) {
			return this;
		}
	}

	setReference(symbol: ISymbol, document: UCDocument, context?: ISymbolContext, noIndex?: boolean, range: Range = this.id.range) {
		this.reference = symbol;
		if (noIndex) {
			return;
		}

		if (symbol && symbol instanceof UCSymbol) {
			const ref: ISymbolReference = {
				location: Location.create(document.filePath, range),
				symbol: this,
				context
			};
			document.indexReference(symbol, ref);
		}
	}

	getReference(): ISymbol | undefined {
		return this.reference;
	}
}
