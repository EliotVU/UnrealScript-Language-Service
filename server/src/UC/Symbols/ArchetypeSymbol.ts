import { SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_NONE } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    addHashedSymbol, ModifierFlags, ObjectsTable, UCFieldSymbol, UCStructSymbol, UCTypeFlags
} from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 */
export class UCArchetypeSymbol extends UCStructSymbol {
    declare outer: UCStructSymbol;
    override modifiers = ModifierFlags.ReadOnly;

    override getKind(): SymbolKind {
        return SymbolKind.Constructor;
    }

    override getTypeFlags() {
        return UCTypeFlags.Archetype;
    }

    override getType() {
        return this.extendsType;
    }

    override getTooltip(): string {
        const text: Array<string | undefined> = ['(archetype)'];

        if (this.extendsType) {
            text.push(`class=${this.super?.getPath()}`);
        } else if (this.super) {
            text.push(`(override)`);
        }
        text.push(`name=${this.getPath()}`);
        return text.filter(s => s).join(' ');
    }

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
        const symbol = this.super?.findSuperSymbol<T>(id, kind);
        return symbol;
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);
        // Lookup the inherited archetype, if it exists.
        if (!this.extendsType && !this.super && context.outer instanceof UCStructSymbol) {
            const inheritedArchetype = ObjectsTable.getSymbol<UCArchetypeSymbol>(this.id.name);
            this.super = inheritedArchetype;
        }

        // Note: It is crucial to hash the object POST @index()
        if (this.id.name !== NAME_NONE) {
            addHashedSymbol(this);
        }
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArchetypeSymbol(this);
    }
}