import { SymbolKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';
import { SemanticErrorNode } from '../diagnostics/diagnostics';

import { ISymbol, UCFieldSymbol, UCSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCStructSymbol, UCSymbolReference } from '.';
import { UCScriptBlock } from "./ScriptBlock";
import { ReliableKeyword, UnreliableKeyword } from './Keywords';

export class UCReplicationBlock extends UCFieldSymbol {
	public symbolRefs = new Map<string, UCSymbolReference>();
	public scriptBlock?: UCScriptBlock;

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName();
	}

	getCompletionContext(position: Position): UCSymbol | undefined {
		if (this.scriptBlock) {
			const symbol = this.scriptBlock.getSymbolAtPos(position);
			if (symbol && symbol instanceof UCSymbolReference) {
				return symbol.getReference() as UCSymbol;
			}
		}
		return this;
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return this.containingStruct
			.getCompletionSymbols(_document)
			.concat(ReliableKeyword, UnreliableKeyword);
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.scriptBlock) {
			const symbol = this.scriptBlock.getSymbolAtPos(position);
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
		this.scriptBlock && this.scriptBlock.index(document, context);
		for (let ref of this.symbolRefs.values()) {
			const symbol = context.findSuperSymbol(ref.getName().toLowerCase());
			if (!symbol) {
				continue;
			}
			ref.setReference(symbol, document);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		this.scriptBlock && this.scriptBlock.analyze(document, context);
		for (let symbolRef of this.symbolRefs.values()) {
			const symbol = symbolRef.getReference();
			if (!symbol) {
				document.nodes.push(new SemanticErrorNode(symbolRef, `Variable '${symbolRef.getName()}' not found!`));
				continue;
			}

			if (symbol instanceof UCPropertySymbol || symbol instanceof UCMethodSymbol) {
				// i.e. not defined in the same class as where the replication statement resides in.
				if (symbol.outer !== this.outer) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbol.getQualifiedName()}' needs to be declared in class '${this.outer.getQualifiedName()}'!`
					);
					document.nodes.push(errorNode);
				}
				continue;
			}

			const errorNode = new SemanticErrorNode(
				symbolRef,
				`Type of '${symbol.getName()}' needs to be either a variable or function!`
			);
			document.nodes.push(errorNode);
		}
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}
}
