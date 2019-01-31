import { SymbolKind, Position } from 'vscode-languageserver-types';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { UCSymbol, UCReferenceSymbol, UCStructSymbol, UCPropertySymbol } from './';
import { UCDocumentListener } from '../DocumentListener';

export class UCDefaultPropertiesSymbol extends UCStructSymbol {
	public varRefs?: Map<string, UCReferenceSymbol>;

	getKind(): SymbolKind {
		return SymbolKind.Module;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
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

	link(_document: UCDocumentListener, context: UCStructSymbol) {
		if (!this.varRefs) {
			return;
		}

		for (let ref of this.varRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getName(), true);
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol);
		}
	}

	analyze(document: UCDocumentListener, _context: UCStructSymbol) {
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
