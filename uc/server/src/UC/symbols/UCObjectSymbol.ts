import { SymbolKind, Position } from 'vscode-languageserver-types';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { UCSymbol, UCSymbolReference, UCStructSymbol, UCPropertySymbol } from '.';
import { UCDocument } from '../DocumentListener';

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	public varRefs = new Map<string, UCSymbolReference>();

	getKind(): SymbolKind {
		return SymbolKind.Module;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.varRefs) {
			return undefined;
		}

		for (let ref of this.varRefs.values()) {
			const symbol = ref.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return undefined;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (!this.varRefs) {
			return;
		}

		for (let ref of this.varRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getName().toLowerCase());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, _context: UCStructSymbol) {
		if (!this.varRefs) {
			return;
		}

		for (let ref of this.varRefs.values()) {
			const symbol = ref.getReference();
			if (!symbol) {
				document.nodes.push(new SemanticErrorNode(ref, `Variable '${ref.getName()}' not found!`));
				continue;
			}
			if (!(symbol instanceof UCPropertySymbol)) {
				const errorNode = new SemanticErrorNode(ref, `Type of '${symbol.getQualifiedName()}' cannot be assigned a default value!`);
				document.nodes.push(errorNode);
			}
		}
	}
}