import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';

import {
	ISymbol, ISymbolReference,
	ISymbolContext, IWithReference,
	UCTypeKind,
	UCSymbol, UCFieldSymbol
} from '.';

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolReference extends UCSymbol implements IWithReference {
	protected reference?: ISymbol;

	/**
	 * The type kind of the symbol we are referencing.
	 * Returns @UCTypeKind.Error if no reference.
	 */
	getTypeKind(): UCTypeKind {
		return this.reference instanceof UCFieldSymbol && this.reference.getTypeKind() || UCTypeKind.Error;
	}

	getTooltip(): string {
		if (this.reference) {
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

		if (this.reference && intersectsWithRange(position, this.id.range)) {
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
