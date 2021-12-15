import { SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { FieldModifiers, UCFieldSymbol, UCStructSymbol, UCTypeFlags } from './';

/**
 * Represents an instanced Archetype found within a defaultproperties block e.g. "begin object class=classID name=objectName".
 */
export class UCArchetypeSymbol extends UCStructSymbol {
    outer: UCStructSymbol;
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

    getTooltip(): string {
        const text: Array<string | undefined> = ['(archetype)'];

        if (this.extendsType) {
            text.push(`class=${this.super?.getPath()}`);
        } else {
            text.push(`(override)`);
        }
        text.push(`name=${this.getPath()}`);
        return text.filter(s => s).join(' ');
    }

    findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
        const symbol = super.findSuperSymbol<T>(id, kind) || this.outer.findSuperSymbol<T>(id, kind);
        return symbol;
    }

    index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);
        // Lookup the inherited archetype, if it exists.
        if (!this.extendsType && !this.super && context.outer instanceof UCStructSymbol) {
            this.super = context.outer.findSuperSymbol<UCStructSymbol>(this.id.name);
        }
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArchetypeSymbol(this);
    }
}