import { Location, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { UCFieldSymbol, UCStructSymbol, UCSymbolReference, UCTypeFlags } from './';

export class UCStateSymbol extends UCStructSymbol {
	public overriddenState?: UCStateSymbol;
	public ignoreRefs?: UCSymbolReference[];

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTypeFlags() {
		return UCTypeFlags.State;
	}

	getTypeKeyword(): string {
		return 'state';
	}

	getTooltip(): string {
		const text: Array<string | undefined> = [];

		if (this.overriddenState) {
			text.push('(override)');
		}

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		text.push(this.getTypeKeyword());
		text.push(this.getPath());

		return text.filter(s => s).join(' ');
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.ignoreRefs) {
			const symbol = this.ignoreRefs.find(ref => !!(ref.getSymbolAtPos(position)));
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
		const symbol = super.findSuperSymbol<T>(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
		return symbol;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		// Look for an overridden state, e.g. "state Pickup {}" would override "Pickup" of "Pickup.uc".
		if (!this.super && context.super) {
			// TODO: If truthy, should "extends ID" be disallowed? Need to investigate how UMake handles this situation.
			const overriddenState = context.super.findSuperSymbol(this.getName());
			if (overriddenState instanceof UCStateSymbol) {
				document.indexReference(overriddenState, {
					location: Location.create(document.uri, this.id.range)
				});
				this.overriddenState = overriddenState;
				this.super = overriddenState;
			}
		}

		super.index(document, context);
		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = this.findSuperSymbol(ref.getName());
			symbol && ref.setReference(symbol, document);
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitState(this);
	}
}