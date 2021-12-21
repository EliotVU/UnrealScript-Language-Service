import { CompletionItemKind, Position, Range, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import {
    Identifier, ISymbol, ITypeSymbol, ModifierFlags, UCFieldSymbol, UCObjectTypeSymbol,
    UCQualifiedTypeSymbol, UCStructSymbol, UCTypeFlags
} from './';

export class UCClassSymbol extends UCStructSymbol {
	override modifiers = ModifierFlags.ReadOnly;

	public withinType?: ITypeSymbol;
    public within?: UCClassSymbol;

	public dependsOnTypes?: UCObjectTypeSymbol[];
	public implementsTypes?: (UCQualifiedTypeSymbol | UCObjectTypeSymbol)[];

    // Maybe classFlags would make more sense,
    // -- however merging IsInterface with UCTypeFlags gives us the convenience of OR'ing type filters.
    public typeFlags = UCTypeFlags.Class;

    isInterface(): boolean {
        return (this.typeFlags & UCTypeFlags.Interface) === UCTypeFlags.Interface;
    }

	override getKind(): SymbolKind {
		return this.isInterface()
            ? SymbolKind.Interface
            : SymbolKind.Class;
	}

	override getTypeFlags() {
		return this.typeFlags;
	}

	override getCompletionItemKind(): CompletionItemKind {
		return this.isInterface()
            ? CompletionItemKind.Interface
            : CompletionItemKind.Class;
	}

	override getTooltip(): string {
		return `class ${this.getPath()}`;
	}

	override getSymbolAtPos(position: Position) {
		if (intersectsWith(this.getRange(), position)) {
			if (intersectsWithRange(position, this.id.range)) {
				return this;
			}
			return this.getContainedSymbolAtPos(position);
		}
		// HACK: due the fact that a class doesn't enclose its symbols we'll have to check for child symbols regardless if the given position is within the declaration span.
		return this.getChildSymbolAtPos(position);
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

	findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCTypeFlags): T | undefined {
		return this.getSymbol<T>(id, kind)
            ?? this.within?.findSuperSymbol(id, kind)
            ?? this.super?.findSuperSymbol(id, kind);
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
            this.within = this.withinType.getRef<UCClassSymbol>();
		}
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitClass(this);
	}
}

export class UCDocumentClassSymbol extends UCClassSymbol {
	constructor(id: Identifier, range: Range = id.range, private document: UCDocument) {
		super(id, range);
	}

	getUri(): string {
		return this.document.uri;
	}
}