import { Location, Position } from 'vscode-languageserver-types';

import { Token } from 'antlr4ts/Token';
import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    SymbolReferenceFlags, UCFieldSymbol, UCObjectTypeSymbol, UCStructSymbol, UCSymbolKind, UCTypeKind
} from './';
import { ModifierFlags } from './ModifierFlags';

export class UCStateSymbol extends UCStructSymbol {
    static readonly allowedKindsMask = 1 << UCSymbolKind.Const
        | 1 << UCSymbolKind.Property
        | 1 << UCSymbolKind.Function;

    override kind = UCSymbolKind.State;
    override modifiers = ModifierFlags.ReadOnly;

    declare public extendsType?: UCObjectTypeSymbol;

	public overriddenState?: UCStateSymbol;
	public ignoreRefs?: UCObjectTypeSymbol[];

	override getTypeKind() {
		return UCTypeKind.Object;
	}

    protected override getTypeHint(): string | undefined {
		if (this.overriddenState) {
            return '(override)';
		}

        return undefined;
    }

	override getTypeKeyword(): string {
		return 'state';
	}

    public buildModifiers(modifiers = this.modifiers): string[] {
		const text: string[] = [];

        // none tracked yet

		return text;
	}

	override getTooltip(): string {
		const text: Array<string | undefined> = [];

        text.push(this.getTypeHint());
		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		text.push(this.getTypeKeyword());
		text.push(this.getPath());

		return text.filter(s => s).join(' ');
	}

    override getDocumentation(): Token | Token[] | undefined {
		const doc = super.getDocumentation();
		if (doc) {
			return doc;
		}

		if (this.overriddenState) {
			return this.overriddenState.getDocumentation();
		}

        return undefined;
	}

	override getContainedSymbolAtPos(position: Position) {
		if (this.ignoreRefs) {
			const symbol = this.ignoreRefs.find(ref => !!(ref.getSymbolAtPos(position)));
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
		const symbol = super.findSuperSymbol<T>(id, kind) ?? (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
		return symbol;
	}

    override findSuperSymbolPredicate<T extends UCFieldSymbol>(predicate: (symbol: UCFieldSymbol) => boolean): T | undefined {
        return this.findSymbolPredicate<T>(predicate) ?? (<UCStructSymbol>(this.outer)).findSuperSymbolPredicate<T>(predicate);
    }

	override index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);

		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = this.findSuperSymbol(ref.getName());
			symbol && ref.setRef(symbol, document);
		}
	}

    protected override indexSuper(document: UCDocument, context: UCStructSymbol) {
        if (context.super) {
            // Look for an overridden state, e.g. "state Pickup {}" would override "Pickup" of "Pickup.uc".
			const symbolOverride = context.super.findSuperSymbol<UCStateSymbol>(this.getName(), UCSymbolKind.State);
			if (symbolOverride) {
				document.indexReference(symbolOverride, {
					location: Location.create(document.uri, this.id.range),
                    flags: SymbolReferenceFlags.Override
				});
				this.overriddenState = symbolOverride;
				this.super = symbolOverride;
			}

            if (this.extendsType && this.extendsType.id.name !== this.id.name) {
                const symbolSuper = context.findSuperSymbol<UCStateSymbol>(this.extendsType.id.name, UCSymbolKind.State);
                if (symbolSuper) {
                    this.extendsType.setRef(symbolSuper, document, this.extendsType.id.range);
                    this.super ??= symbolSuper;
                }
            }
		}
    }

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitState(this);
	}
}
