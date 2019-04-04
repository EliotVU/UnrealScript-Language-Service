import { SymbolKind, Position } from 'vscode-languageserver-types';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { UCSymbol, UCSymbolReference, UCStructSymbol, UCPropertySymbol } from '.';
import { UCDocument } from '../DocumentListener';

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	public symbolRefs = new Map<string, UCSymbolReference>();

	getKind(): SymbolKind {
		return SymbolKind.Module;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let ref of this.symbolRefs.values()) {
			const symbol = ref.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getName().toLowerCase());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		for (let ref of this.symbolRefs.values()) {
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