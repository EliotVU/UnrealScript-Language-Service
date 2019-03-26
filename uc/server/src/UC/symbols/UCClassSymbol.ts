import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol, UCPropertySymbol, UCTypeSymbol, UCMethodSymbol } from './';
import { UCDocument } from '../DocumentListener';
import { SemanticErrorNode } from '../diagnostics/diagnostics';

export class UCClassSymbol extends UCStructSymbol {
	public withinType?: UCTypeSymbol;
	public repFieldRefs?: UCReferenceSymbol[];

	public dependsOnTypes?: UCTypeSymbol[];
	public implementsTypes?: UCTypeSymbol[];

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Class;
	}

	getTooltip(): string {
		return `class ${this.getQualifiedName()}`;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.intersectsWith(position)) {
			if (this.intersectsWithName(position)) {
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

		if (this.dependsOnTypes) {
			for (let depType of this.dependsOnTypes) {
				const symbol = depType.getSymbolAtPos(position);
				if (symbol) {
					return symbol;
				}
			}
		}

		if (this.implementsTypes) {
			for (let depType of this.implementsTypes) {
				const symbol = depType.getSymbolAtPos(position);
				if (symbol) {
					return symbol;
				}
			}
		}

		// NOTE: Never call super, see HACK above.
		return undefined;
	}

	getContextSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let symbol = this.children; symbol; symbol = symbol.next) {
			if (symbol instanceof UCStructSymbol) {
				const subSymbol = symbol.getContextSymbolAtPos(position);
				if (subSymbol) {
					return subSymbol;
				}
				continue;
			}

			if (symbol.intersectsWith(position)) {
				return symbol;
			}
		}
		return this;
	}

	link(document: UCDocument, context: UCClassSymbol) {
		if (this.withinType) {
			this.withinType.link(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinType.getReference() as UCClassSymbol;
		}

		if (this.dependsOnTypes) {
			for (let depType of this.dependsOnTypes) {
				depType.link(document, context);
			}
		}

		if (this.implementsTypes) {
			for (let depType of this.implementsTypes) {
				depType.link(document, context);
			}
		}

		super.link(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
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

				symbolRef.setReference(symbol, document);
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

		if (this.withinType) {
			this.withinType.analyze(document, context);
		}

		if (this.dependsOnTypes) {
			for (let depType of this.dependsOnTypes) {
				depType.analyze(document, context);
			}
		}

		if (this.implementsTypes) {
			for (let depType of this.implementsTypes) {
				depType.analyze(document, context);
			}
		}
		super.analyze(document, context);
	}
}

export class UCDocumentClassSymbol extends UCClassSymbol {
	public document?: UCDocument;

	getUri(): string {
		return this.document.uri;
	}

	link(document: UCDocument, context: UCClassSymbol = document.class) {
		if (this.document) {
			return;
		}

		this.document = document;
		super.link(document, context);
	}
}