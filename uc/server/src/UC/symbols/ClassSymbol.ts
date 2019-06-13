import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { intersectsWith, intersectsWithRange } from '../helpers';

import { UCSymbol, UCStructSymbol, UCTypeSymbol } from '.';
import { SymbolWalker } from '../symbolWalker';

export class UCClassSymbol extends UCStructSymbol {
	public withinType?: UCTypeSymbol;

	public dependsOnTypes?: UCTypeSymbol[];
	public implementsTypes?: UCTypeSymbol[];

	isType(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Class;
	}

	getTooltip(): string {
		return `class ${this.getQualifiedName()}`;
	}

	getSymbolAtPos(position: Position) {
		if (intersectsWith(this.getRange(), position)) {
			if (intersectsWithRange(position, this.id.range)) {
				return this;
			}
			return this.getContainedSymbolAtPos(position);
		}
		// HACK: due the fact that a class doesn't enclose its symbols we'll have to check for child symbols regardless if the given position is within the declaration span.
		return this.getChildSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position) {
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

	getCompletionContext(position: Position) {
		for (let symbol = this.children; symbol; symbol = symbol.next) {
			if (intersectsWith(symbol.getRange(), position)) {
				return symbol.getCompletionContext(position);
			}
		}
		return this;
	}

	index(document: UCDocument, context: UCClassSymbol) {
		if (this.withinType) {
			this.withinType.index(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinType.getReference() as UCClassSymbol;
		}

		if (this.dependsOnTypes) {
			for (let depType of this.dependsOnTypes) {
				depType.index(document, context);
			}
		}

		if (this.implementsTypes) {
			for (let depType of this.implementsTypes) {
				depType.index(document, context);
			}
		}

		super.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		const className = this.getName();
		if (className.toLowerCase() != document.fileName.toLowerCase()) {
			const errorNode = new SemanticErrorNode(
				this,
				`Class name '${className}' must be equal to its file name ${document.fileName}!`,
			);
			document.nodes.push(errorNode);
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

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitClass(this);
	}
}

export class UCDocumentClassSymbol extends UCClassSymbol {
	public document?: UCDocument;

	getUri(): string {
		return this.document!.filePath;
	}

	index(document: UCDocument, context: UCClassSymbol = document.class!) {
		if (this.document) {
			return;
		}

		this.document = document;
		super.index(document, context);
	}
}