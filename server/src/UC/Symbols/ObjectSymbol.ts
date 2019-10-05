import { SymbolKind } from 'vscode-languageserver-types';

import { Name } from '../names';
import { SymbolWalker } from '../symbolWalker';
import { UCDocument } from '../document';

import { UCStructSymbol, ClassesTable } from '.';
import { UCClassSymbol } from './ClassSymbol';
import { UCObjectTypeSymbol, UCTypeKind } from './TypeSymbol';
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.classId) {
			this.classType = new UCObjectTypeSymbol(this.classId, undefined, UCTypeKind.Class);

			const objectClass = ClassesTable.findSymbol(this.classId.name, true) as UCClassSymbol;
			this.classType.setReference(objectClass, document);

			if (objectClass) {
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