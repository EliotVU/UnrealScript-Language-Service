import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { Name } from '../names';

import { ReliableKeyword, UnreliableKeyword, IfKeyword } from './Keywords';
import { ISymbol, UCSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCStructSymbol, UCSymbolReference } from '.';

export class UCReplicationBlock extends UCStructSymbol {
	public symbolRefs = new Map<Name, UCSymbolReference>();

	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getId().toString();
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return super
			.getCompletionSymbols(_document)
			.concat(ReliableKeyword, UnreliableKeyword, IfKeyword);
	}

	getContainedSymbolAtPos(position: Position) {
		for (let ref of this.symbolRefs.values()) {
			const symbol = ref.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		console.assert(document.class, 'Tried to index a replication block without a class reference!');
		// We index our block here, because in the parent class a block is no longer indexed automatically.
		if (this.block) {
			this.block.index(document, document.class!);
		}
		super.index(document, document.class!);

		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getId());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, _context: UCStructSymbol) {
		console.assert(document.class, 'Tried to analyze a replication block without a class reference!');
		super.analyze(document, document.class!);

		for (let symbolRef of this.symbolRefs.values()) {
			const symbol = symbolRef.getReference();
			if (!symbol) {
				document.nodes.push(new SemanticErrorNode(symbolRef, `Variable '${symbolRef.getId()}' not found!`));
				continue;
			}

			if (symbol instanceof UCPropertySymbol || symbol instanceof UCMethodSymbol) {
				// i.e. not defined in the same class as where the replication statement resides in.
				if (symbol.outer !== document.class) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbol.getQualifiedName()}' needs to be declared in class '${document.class!.getQualifiedName()}'!`
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
