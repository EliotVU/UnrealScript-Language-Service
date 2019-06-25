import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';
import { SemanticErrorNode, UnrecognizedFieldNode } from '../diagnostics/diagnostics';

import { UCSymbolReference, UCStructSymbol, UCMethodSymbol } from ".";

export class UCStateSymbol extends UCStructSymbol {
	public ignoreRefs?: UCSymbolReference[];

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getQualifiedName()}`;
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

	findSuperSymbol(id: Name) {
		const symbol = super.findSuperSymbol(id) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id);
		return symbol;
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
				document.nodes.push(new SemanticErrorNode(ref, `'${symbol.getId()}' is not a function.`));
			}
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitState(this);
	}
}