import { SymbolKind } from 'vscode-languageserver-types';

import { Name } from '../names';

import { UCStructSymbol } from '.';

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	public objectName?: Name;

	getId(): Name {
		return this.objectName || super.getId();
	}

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}
}