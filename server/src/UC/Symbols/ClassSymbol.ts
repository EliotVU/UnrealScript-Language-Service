import { Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    ISymbol,
    ITypeSymbol,
    ModifierFlags,
    UCArchetypeSymbol,
    UCFieldSymbol,
    UCObjectTypeSymbol,
    UCPackage,
    UCQualifiedTypeSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';

export enum ClassModifierFlags {
    None,

    /** The class is declared as an 'interface' */
    Interface = 1 << 0,
}

export class UCClassSymbol extends UCStructSymbol {
    static readonly allowedKindsMask = 1 << UCSymbolKind.Const
        | 1 << UCSymbolKind.Enum
        | 1 << UCSymbolKind.ScriptStruct
        | 1 << UCSymbolKind.Property
        | 1 << UCSymbolKind.Function
        | 1 << UCSymbolKind.Event
        | 1 << UCSymbolKind.Delegate;

    declare outer: UCPackage;
    declare super?: UCClassSymbol;

    override kind = UCSymbolKind.Class;
    override modifiers = ModifierFlags.ReadOnly;

    public classModifiers: ClassModifierFlags = ClassModifierFlags.None;

    public withinType?: ITypeSymbol;
    public within?: UCClassSymbol;

    public dependsOnTypes?: UCObjectTypeSymbol[];
    public implementsTypes?: (UCQualifiedTypeSymbol | UCObjectTypeSymbol)[];

    /**
     * (UC3) A generated symbol to hold onto object declarations (archetypes)
     * If archetypes are not available, it will be referencing the outer class or struct.
     */
    public defaults: UCStructSymbol | UCArchetypeSymbol;

    override getTypeKind() {
        return UCTypeKind.Object;
    }

    protected override getTypeKeyword(): string | undefined {
        return 'class';
    }

    override getTooltip(): string {
        const text: Array<string | undefined> = [];
        text.push(this.getTypeHint());
        text.push(`${this.getTypeKeyword()} ${this.getPath()}`);
        if (this.super) {
            text.push(`extends ${this.super.getPath()}`);
        }
        if (this.withinType) {
            text.push(`within ${this.withinType.getRef()?.getPath()}`);
        }

        const modifiers = this.buildModifiers();
        if (modifiers.length > 0) {
            text.push('\n\t' + modifiers.join('\n\t'));
        }
        return text.filter(s => s).join(' ');
    }

    override buildModifiers(modifiers = this.modifiers): string[] {
        const text: string[] = [];

        if (modifiers & ModifierFlags.Native) {
            text.push('native');
        }

        if (modifiers & ModifierFlags.Transient) {
            text.push('abstract');
        }

        if (modifiers & ModifierFlags.Abstract) {
            text.push('transient');
        }

        return text;
    }

    override getContainedSymbolAtPos(position: Position) {
        let symbol: ISymbol | undefined = undefined;
        if (this.extendsType && (symbol = this.extendsType.getSymbolAtPos(position))) {
            return symbol;
        }

        if (this.withinType && (symbol = this.withinType.getSymbolAtPos(position))) {
            return symbol;
        }

        if (this.dependsOnTypes) {
            for (const depType of this.dependsOnTypes) {
                const symbol = depType.getSymbolAtPos(position);
                if (symbol) {
                    return symbol;
                }
            }
        }

        if (this.implementsTypes) {
            for (const depType of this.implementsTypes) {
                const symbol = depType.getSymbolAtPos(position);
                if (symbol) {
                    return symbol;
                }
            }
        }

        // NOTE: Never call super, see HACK above.
        return undefined;
    }

    override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind): T | undefined {
        return this.getSymbol<T>(id, kind)
            ?? this.super?.findSuperSymbol(id, kind)
            ?? this.within?.findSuperSymbol(id, kind);
    }

    override findSuperSymbolPredicate<T extends UCFieldSymbol>(predicate: (symbol: UCFieldSymbol) => boolean): T | undefined {
        return this.findSymbolPredicate<T>(predicate)
            ?? this.super?.findSuperSymbolPredicate<T>(predicate)
            ?? this.within?.findSuperSymbolPredicate<T>(predicate);
    }

    override index(document: UCDocument, context: UCClassSymbol) {
        if (this.dependsOnTypes) {
            for (const classTypeRef of this.dependsOnTypes) {
                classTypeRef.index(document, context);
            }
        }

        if (this.implementsTypes) {
            for (const interfaceTypeRef of this.implementsTypes) {
                interfaceTypeRef.index(document, context);
            }
        }

        super.index(document, context);

        if (this.withinType) {
            this.withinType.index(document, context);
            this.within ??= this.withinType.getRef<UCClassSymbol>();
        }
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitClass(this);
    }
}
