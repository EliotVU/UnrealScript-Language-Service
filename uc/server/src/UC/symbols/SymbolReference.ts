import { Location, Range, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith } from '../helpers';

import { ISymbol, ISymbolReference, ISymbolContext, IWithReference } from './ISymbol';
import { UCSymbol } from '.';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolReference extends UCSymbol implements IWithReference {
	protected reference?: ISymbol;

	constructor(private refName: string, refNameRange: Range) {
		super(refNameRange);
	}

	// Redirect name to our resolved reference, so that e.g. 'obJeCT' resolves to the properly declared name 'Object'.
	getName(): string {
		return this.reference ? this.reference.getName() : this.refName;
	}

	getQualifiedName(): string {
		if (this.reference) {
			return this.reference.getQualifiedName();
		}
		return this.refName;
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.getSpanRange(), position)) {
			return undefined;
		}

		const symbol = this.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.intersectsWithName(position)) {
			return this;
		}
	}

	setReference(symbol: ISymbol, document: UCDocument, context?: ISymbolContext) {
		this.reference = symbol;
		if (symbol && symbol instanceof UCSymbol) {
			const ref: ISymbolReference = {
				location: Location.create(document.filePath, this.getNameRange()),
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
