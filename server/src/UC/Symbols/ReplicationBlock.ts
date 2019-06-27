import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { UCBlock } from '../statements';
import { Name } from '../names';

import { ReliableKeyword, UnreliableKeyword } from './Keywords';
import { ISymbol, UCFieldSymbol, UCSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCStructSymbol, UCSymbolReference } from '.';

export class UCReplicationBlock extends UCFieldSymbol {
	public symbolRefs = new Map<Name, UCSymbolReference>();
	public block?: UCBlock;

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getId().toString();
	}

	getCompletionContext(position: Position) {
		if (this.block) {
			const symbol = this.block.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return this;
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return this.containingStruct!
			.getCompletionSymbols(_document)
			.concat(ReliableKeyword, UnreliableKeyword);
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.block) {
			const symbol = this.block.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		for (let ref of this.symbolRefs.values()) {
			const symbol = ref.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		return undefined;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		this.block && this.block.index(document, context);
		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getId());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		this.block && this.block.analyze(document, context);
		for (let symbolRef of this.symbolRefs.values()) {
			const symbol = symbolRef.getReference();
			if (!symbol) {
				document.nodes.push(new SemanticErrorNode(symbolRef, `Variable '${symbolRef.getId()}' not found!`));
				continue;
			}

			if (symbol instanceof UCPropertySymbol || symbol instanceof UCMethodSymbol) {
				// i.e. not defined in the same class as where the replication statement resides in.
				if (symbol.outer !== this.outer) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbol.getQualifiedName()}' needs to be declared in class '${this.outer!.getQualifiedName()}'!`
					);
					document.nodes.push(errorNode);
				}
				continue;
			}

			const errorNode = new SemanticErrorNode(
				symbolRef,
				`Type of '${symbol.getId()}' needs to be either a variable or function!`
			);
			document.nodes.push(errorNode);
		}
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}
}
