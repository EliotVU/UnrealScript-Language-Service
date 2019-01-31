import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { UCSymbol } from './UCSymbol';
import { UCDocumentListener } from '../DocumentListener';
import { UCSymbolRef } from "./UCSymbolRef";
import { UCStructSymbol } from "./UCStructSymbol";
import { UCPropertySymbol } from "./UCPropertySymbol";
import { UCTypeRef } from "./UCTypeRef";
import { UCFunctionSymbol } from "./UCFunctionSymbol";

export class UCClassSymbol extends UCStructSymbol {
	public document?: UCDocumentListener;

	public withinRef?: UCTypeRef;
	public replicatedFieldRefs?: UCSymbolRef[];

	public within?: UCClassSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Class;
	}

	getTooltip(): string {
		return `class ${this.getQualifiedName()}`;
	}

	getUri(): string {
		return this.document.uri;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}
			return this.getSubSymbolAtPos(position);
		}
		// TODO: Optimize
		if (this.replicatedFieldRefs) {
			for (let ref of this.replicatedFieldRefs) {
				if (ref.getSymbolAtPos(position)) {
					return ref;
				}
			}
		}
		// HACK: due the fact that a class doesn't enclose its symbols we'll have to check for child symbols regardless if the given position is within the declaration span.
		return this.getChildSymbolAtPos(position);
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
			return this.extendsRef;
		}

		if (this.withinRef && this.withinRef.getSymbolAtPos(position)) {
			return this.withinRef;
		}

		// NOTE: Never call super, see HACK above.
		return undefined;
	}

	link(document: UCDocumentListener, context: UCClassSymbol = document.class) {
		this.document = document;
		if (this.withinRef) {
			this.withinRef.link(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinRef.getReference() as UCClassSymbol;
		}
		super.link(document, context);
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		const className = this.getName();
		if (className.toLowerCase() != document.name.toLowerCase()) {
			const errorNode = new SemanticErrorNode(
				this,
				`Class name '${className}' must be equal to its file name ${document.name}!`,
			);
			document.nodes.push(errorNode);
		}

		if (this.replicatedFieldRefs) {
			for (let symbolRef of this.replicatedFieldRefs) {
				// ref.link(document);
				let symbol = this.findSymbol(symbolRef.getName());
				if (!symbol) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbolRef.getName()}' does not exist in class '${className}'.`
					);
					document.nodes.push(errorNode);
					continue;
				}

				symbolRef.setReference(symbol);
				if (symbol instanceof UCPropertySymbol || symbol instanceof UCFunctionSymbol) {
					continue;
				}

				const errorNode = new SemanticErrorNode(
					symbolRef,
					`Type of field '${symbol.getName()}' is not replicatable!`
				);
				document.nodes.push(errorNode);
			}
		}
		super.analyze(document, context);
	}
}