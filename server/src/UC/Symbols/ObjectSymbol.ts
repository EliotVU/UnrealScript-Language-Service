import { SymbolKind } from 'vscode-languageserver-types';

import { Name } from '../names';
import { SymbolWalker } from '../symbolWalker';
import { UCDocument } from '../document';

import { UCStructSymbol } from '.';
import { UCObjectTypeSymbol, UCTypeFlags } from './TypeSymbol';
import { Identifier } from './ISymbol';

/**
 * Represents an instanced Archetype found within in a defaultproperties e.g. "begin object class=classID name=objectName".
 */
export class UCObjectSymbol extends UCStructSymbol {
	public objectName?: Name;
	public classId?: Identifier;

	getName(): Name {
		return this.objectName || super.getName();
	}

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Archetype;
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		if (this.classId) {
			// TODO: Find @super, for declarations where no class=NAME was specified
			this.extendsType = new UCObjectTypeSymbol(this.classId, undefined, UCTypeFlags.Class);
		}
		super.index(document, this);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitObjectSymbol(this);
	}
}