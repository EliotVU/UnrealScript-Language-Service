import { Location, Range, Position } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { UCSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCReferenceSymbol extends UCSymbol {
	protected reference?: ISymbol;

	// TODO: evaulate if span range is needed for reference symbols?
	constructor(private symbolName: string, range: Range) {
		super(range);
	}

	getName(): string {
		return this.symbolName;
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.intersectsWith(position)) {
			return undefined;
		}

		if (this.intersectsWithName(position)) {
			return this;
		}
		return this.getSubSymbolAtPos(position);
	}

	setReference(symbol: ISymbol, document: UCDocumentListener) {
		this.reference = symbol;
		if (symbol && symbol instanceof UCSymbol) {
			symbol.registerReference(Location.create(document.uri, this.getNameRange()));
		}
	}

	getReference(): ISymbol | undefined {
		return this.reference;
	}

	getReferencedLocations(): Location[] | undefined {
		var ref = this.getReference();
		return ref instanceof UCSymbol
			? ref.getReferencedLocations()
			: super.getReferencedLocations();
	}
}
