import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_NONE } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    addHashedSymbol,
    ModifierFlags,
    ObjectsTable,
    UCFieldSymbol,
    UCObjectSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 */
export class UCArchetypeSymbol extends UCStructSymbol {
    override kind = UCSymbolKind.Archetype;
    declare outer: UCObjectSymbol;
    override modifiers = ModifierFlags.ReadOnly;

    override getTypeKind() {
        return UCTypeKind.Object;
    }

    override getType() {
        return this.extendsType;
    }

    override getTooltip(): string {
        const text: Array<string | undefined> = ['(archetype)'];

        text.push(super.getTypeHint());
        if (this.super) {
            if (!this.extendsType) {
                text.push(`(override)`);
            }
            text.push(`class=${this.super?.getPath()}`);
        }
        text.push(`name=${this.getPath()}`);
        return text.filter(s => s).join(' ');
    }

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
        const symbol = this.super?.findSuperSymbol<T>(id, kind);
        return symbol;
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);
        // Lookup the inherited archetype, if it exists.
        if (!this.extendsType && !this.super) {
            const inheritedArchetype = ObjectsTable.getSymbol<UCArchetypeSymbol>(this.id.name, UCSymbolKind.Archetype);
            this.super = inheritedArchetype?.super;
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