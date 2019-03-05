import { Location, Range, Position } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { UCSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCReferenceSymbol extends UCSymbol {
	protected reference?: ISymbol;

	constructor(private symbolName: string, nameRange: Range) {
		super(nameRange);
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

		const symbol = this.getSubSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.intersectsWithName(position)) {
			return this;
		}
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
