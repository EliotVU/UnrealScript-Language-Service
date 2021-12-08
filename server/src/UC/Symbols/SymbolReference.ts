import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';
import {
    isTypeSymbol, ISymbol, ISymbolReference, ITypeSymbol, IWithReference, UCSymbol, UCTypeFlags
} from './';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolReference extends UCSymbol implements IWithReference {
	protected reference?: ISymbol | ITypeSymbol;

	/**
	 * The type kind of the symbol we are referencing.
	 * Returns @UCTypeKind.Error if no reference.
	 */
	getTypeFlags(): UCTypeFlags {
		return this.reference && isTypeSymbol(<ITypeSymbol>this.reference)
			? (<ITypeSymbol>this.reference).getTypeFlags()
			: UCTypeFlags.Error;
	}

	getTooltip(): string {
		if (this.reference instanceof UCSymbol) {
			return this.reference.getTooltip();
		}
		return '';
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

	setReference(symbol: ISymbol, document: UCDocument, noIndex?: boolean, range?: Range): ISymbolReference | undefined {
		this.reference = symbol;

		if (noIndex) {
			return undefined;
		}
		const ref: ISymbolReference = { location: Location.create(document.uri, range || this.id.range) };
		document.indexReference(symbol, ref);
		return ref;
	}

	getRef<T extends ISymbol>(): T | undefined {
		return this.reference as T;
	}
}
