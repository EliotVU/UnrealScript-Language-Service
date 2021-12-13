import { SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { FieldModifiers, UCStructSymbol, UCTypeFlags } from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 */
export class UCArchetypeSymbol extends UCStructSymbol {
	modifiers = FieldModifiers.ReadOnly;

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Archetype;
	}

    getType() {
        return this.extendsType;
    }

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitArchetypeSymbol(this);
	}
}