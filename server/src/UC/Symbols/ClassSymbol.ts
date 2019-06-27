import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { SymbolWalker } from '../symbolWalker';
import { toHash } from '../names';

import { UCStructSymbol, UCTypeSymbol, ITypeSymbol, ISymbol } from '.';

export class UCClassSymbol extends UCStructSymbol {
	public withinType?: ITypeSymbol;

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
		let symbol: ISymbol | undefined = undefined;
		if (this.extendsType && (symbol = this.extendsType.getSymbolAtPos(position))) {
			return symbol;
		}

		if (this.withinType && (symbol = this.withinType.getSymbolAtPos(position))) {
			return symbol;
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
			for (let classTypeRef of this.dependsOnTypes) {
				classTypeRef.index(document, context);
			}
		}

		if (this.implementsTypes) {
			for (let interfaceTypeRef of this.implementsTypes) {
				interfaceTypeRef.index(document, context);
			}
		}

		super.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		const className = this.getId();
		if (className.hash != toHash(document.fileName)) {
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
			for (let classTypeRef of this.dependsOnTypes) {
				classTypeRef.analyze(document, context);
			}
		}

		if (this.implementsTypes) {
			for (let interfaceTypeRef of this.implementsTypes) {
				interfaceTypeRef.analyze(document, context);
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
	private hasBeenIndexed = false;

	getUri(): string {
		console.assert(this.document, 'Document was accessed before being initialized! Make sure that the class is indexed first!');
		return this.document!.filePath;
	}

	index(document: UCDocument, context: UCClassSymbol = document.class!) {
		if (this.hasBeenIndexed) {
			return;
		}

		// Assign it before calling super, as we don't want to end up in a situation,
		// -- where for example index would throw an error,
		// -- and then each dependency would re-retry to index this class yet again!
		this.hasBeenIndexed = true;
		super.index(document, context);
	}
}