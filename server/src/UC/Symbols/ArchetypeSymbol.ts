import { UCDocument } from 'UC/document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    ModifierFlags,
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
