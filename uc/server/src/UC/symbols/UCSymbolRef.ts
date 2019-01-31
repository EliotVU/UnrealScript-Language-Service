import { Location } from 'vscode-languageserver-types';

import { ISimpleSymbol } from './ISimpleSymbol';
import { UCSymbol } from './UCSymbol';
import { ISymbolId } from './ISymbolId';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolRef extends UCSymbol {
	protected reference?: ISimpleSymbol;

	constructor(id: ISymbolId, outer: ISimpleSymbol) {
		super(id);
		this.outer = outer;
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	setReference(symbol: ISimpleSymbol) {
		this.reference = symbol;
		if (symbol && symbol instanceof UCSymbol) {
			symbol.registerReference(Location.create(this.getUri(), this.getIdRange()));
		}
	}

	getReference(): ISimpleSymbol | undefined {
		return this.reference;
	}

	getReferencedLocations(): Location[] | undefined {
		var ref = this.getReference();
		return ref instanceof UCSymbol
			? ref.getReferencedLocations()
			: super.getReferencedLocations();
	}
}
