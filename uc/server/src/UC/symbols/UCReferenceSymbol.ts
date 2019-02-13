import { Location } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { ISymbolId } from './ISymbolId';
import { UCSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCReferenceSymbol extends UCSymbol {
	protected reference?: ISymbol;

	constructor(id: ISymbolId) {
		super(id);
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	setReference(symbol: ISymbol, document: UCDocumentListener) {
		this.reference = symbol;
		if (symbol && symbol instanceof UCSymbol) {
			symbol.registerReference(Location.create(document.uri, this.getRange()));
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
