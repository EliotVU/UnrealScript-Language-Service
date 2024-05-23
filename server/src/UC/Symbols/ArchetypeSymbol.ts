import { UCDocument } from 'UC/document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    ModifierFlags,
    UCClassSymbol,
    UCFieldSymbol,
    UCObjectSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 * Also known as subobjects, in diagnostics (exposed to the end-user) we refer to subobjects as an 'Object declaration' and represent the symbol as a (archetype) type.
 */
export class UCArchetypeSymbol extends UCStructSymbol {
    override kind = UCSymbolKind.Archetype;
    declare outer: UCObjectSymbol;
    declare super?: UCClassSymbol;
    override modifiers = ModifierFlags.ReadOnly;

    public overriddenArchetype?: UCArchetypeSymbol;
    public document: UCDocument;

    override getTypeKind() {
        return UCTypeKind.Object;
    }

    override getType() {
        return this.extendsType;
    }

    override getTooltip(): string {
        const text: Array<string | undefined> = ['(archetype)'];

        text.push(super.getTypeHint());
        if (this.overriddenArchetype) {
            text.push(`(override)`);
        }
        if (this.super) {
            text.push(`Class=${this.super?.getPath()}`);
        }
        text.push(`Name=${this.getPath()}`);
        return text.filter(s => s).join(' ');
    }

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
        return this.super?.findSuperSymbol<T>(id, kind);
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        this.indexSuper(document, context);
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArchetypeSymbol(this);
    }
}
