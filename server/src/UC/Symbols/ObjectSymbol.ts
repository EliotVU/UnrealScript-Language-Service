import { SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { UCStructSymbol, UCTypeFlags } from './';

/**
 * Represents an instanced Archetype found within in a defaultproperties e.g. "begin object class=classID name=objectName".
 */
export class UCObjectSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Archetype;
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		// TODO: Find @super, for declarations where no class=NAME was specified
		if (this.extendsType) {
			// FIXME: extendsType is indexed twice (by assignmentExpresion "class=ClassNameManually")
			// -- set the type reference here so that turn on "noIndex".
		}
		super.index(document, this);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitObjectSymbol(this);
	}
}