import { SymbolKind } from 'vscode-languageserver-types';

import { Name } from '../names';
import { SymbolWalker } from '../symbolWalker';
import { UCDocument } from '../document';

import { UCStructSymbol, tryFindClassSymbol } from '.';
import { UCObjectTypeSymbol, UCTypeFlags } from './TypeSymbol';
import { Identifier } from './ISymbol';

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	public objectName?: Name;
	public classId?: Identifier;
	public classType?: UCObjectTypeSymbol;

	getId(): Name {
		return this.objectName || super.getId();
	}

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Object;
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		if (this.classId) {
			this.classType = new UCObjectTypeSymbol(this.classId, undefined, UCTypeFlags.Class);

			const objectClass = tryFindClassSymbol(this.classId.name);
			if (objectClass) {
				this.classType.setReference(objectClass, document);

				// TODO: Find @super, for declarations where no class=NAME was specified
				this.super = objectClass;
			}
		}

		super.index(document, this);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitObjectSymbol(this);
	}
}