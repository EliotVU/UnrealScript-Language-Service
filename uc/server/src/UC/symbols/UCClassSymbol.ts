import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol, UCPropertySymbol, UCTypeSymbol, UCMethodSymbol } from './';
import { UCDocumentListener } from '../DocumentListener';
import { SemanticErrorNode } from '../diagnostics/diagnostics';

export class UCClassSymbol extends UCStructSymbol {
	public document?: UCDocumentListener;

	public withinType?: UCTypeSymbol;
	public repFieldRefs?: UCReferenceSymbol[];

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
		if (this.repFieldRefs) {
			for (let ref of this.repFieldRefs) {
				if (ref.getSymbolAtPos(position)) {
					return ref;
				}
			}
		}
		// HACK: due the fact that a class doesn't enclose its symbols we'll have to check for child symbols regardless if the given position is within the declaration span.
		return this.getChildSymbolAtPos(position);
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.extendsType && this.extendsType.getSymbolAtPos(position)) {
			return this.extendsType;
		}

		if (this.withinType && this.withinType.getSymbolAtPos(position)) {
			return this.withinType;
		}

		// NOTE: Never call super, see HACK above.
		return undefined;
	}

	link(document: UCDocumentListener, context: UCClassSymbol = document.class) {
		this.document = document;
		if (this.withinType) {
			this.withinType.link(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinType.getReference() as UCClassSymbol;
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

		if (this.repFieldRefs) {
			for (let symbolRef of this.repFieldRefs) {
				// ref.link(document);
				let symbol = this.findSymbol(symbolRef.getName().toLowerCase());
				if (!symbol) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbolRef.getName()}' does not exist in class '${className}'.`
					);
					document.nodes.push(errorNode);
					continue;
				}

				symbolRef.setReference(symbol);
				if (symbol instanceof UCPropertySymbol || symbol instanceof UCMethodSymbol) {
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