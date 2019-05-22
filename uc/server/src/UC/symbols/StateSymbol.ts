import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';
import { SymbolVisitor } from '../SymbolVisitor';
import { SemanticErrorNode, UnrecognizedFieldNode } from '../diagnostics/diagnostics';

import { UCStructSymbol, UCMethodSymbol, UCSymbol } from ".";
import { UCSymbolReference } from './SymbolReference';

export class UCStateSymbol extends UCStructSymbol {
	public ignoreRefs: UCSymbolReference[];

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
		if (this.ignoreRefs) {
			const symbol = this.ignoreRefs.find(ref => !!(ref.getSymbolAtPos(position)));
			if (symbol) {
				return symbol;
			}
		}
		return this.getChildSymbolAtPos(position);
	}

	findSuperSymbol(id: string): UCSymbol {
		return super.findSuperSymbol(id)
			|| (this.outer instanceof UCStructSymbol && this.outer.findSuperSymbol(id));
	}

	findTypeSymbol(id: string, deepSearch: boolean): UCSymbol {
		return (this.outer as UCStructSymbol).findTypeSymbol(id, deepSearch);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = this.findSuperSymbol(ref.getId());
			symbol && ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);

		if (this.ignoreRefs) for (const ref of this.ignoreRefs) {
			const symbol = ref.getReference();
			if (!symbol) {
				document.nodes.push(new UnrecognizedFieldNode(ref, context));
			} else if (symbol instanceof UCMethodSymbol) {
				if (symbol.isFinal()) {
					document.nodes.push(new SemanticErrorNode(ref, `Cannot ignore final functions.`));
				}
			} else {
				document.nodes.push(new SemanticErrorNode(ref, `'${symbol.getName()}' is not a function.`));
			}
		}
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitState(this);
	}
}