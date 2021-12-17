import { SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { ModifierFlags, UCFieldSymbol, UCStructSymbol, UCTypeFlags } from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 */
export class UCArchetypeSymbol extends UCStructSymbol {
    override outer: UCStructSymbol;
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
        } else {
            text.push(`(override)`);
        }
        text.push(`name=${this.getPath()}`);
        return text.filter(s => s).join(' ');
    }

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
        const symbol = super.findSuperSymbol<T>(id, kind) || this.outer.findSuperSymbol<T>(id, kind);
        return symbol;
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);
        // Lookup the inherited archetype, if it exists.
        if (!this.extendsType && !this.super && context.outer instanceof UCStructSymbol) {
            this.super = context.outer.findSuperSymbol<UCStructSymbol>(this.id.name);
        }
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArchetypeSymbol(this);
    }
}