import { SymbolKind, Position, Location } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import { UCSymbolReference, UCStructSymbol } from ".";

export class UCStateSymbol extends UCStructSymbol {
	public overriddenState?: UCStateSymbol;
	public ignoreRefs?: UCSymbolReference[];

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
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
		text.push(this.getQualifiedName());

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

	findSuperSymbol(id: Name, kind?: SymbolKind) {
		const symbol = super.findSuperSymbol(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id, kind);
		return symbol;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		// Look for an overridden state, e.g. "state Pickup {}" would override "Pickup" of "Pickup.uc".
		if (!this.super && context.super) {
			// TODO: If truthy, should "extends ID" be disallowed? Need to investigate how UMake handles this situation.
			const overriddenState = context.super.findSuperSymbol(this.getId());
			if (overriddenState instanceof UCStateSymbol) {
				document.indexReference(overriddenState, {
					location: Location.create(document.filePath, this.id.range)
				});
				this.overriddenState = overriddenState;
				this.super = overriddenState;
			}
		}

		super.index(document, context);
		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = this.findSuperSymbol(ref.getId());
			symbol && ref.setReference(symbol, document);
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitState(this);
	}
}