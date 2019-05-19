import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';
import { UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';

import {
	UCSymbol,
	UCSymbolReference,
	UCStructSymbol,
	UCClassSymbol,
	UCStateSymbol,
	UCScriptStructSymbol,
	UCMethodSymbol,
	UCEnumSymbol,
	SymbolsTable,
	CORE_PACKAGE
} from '.';
import { UCTypeKind } from './TypeKind';
import { ISymbol } from './ISymbol';

export class UCTypeSymbol extends UCSymbolReference {
	public baseType?: UCTypeSymbol;

	constructor(typeName: string, typeRange: Range, private spanRange?: Range, private typeKind?: UCTypeKind) {
		super(typeName, typeRange);
	}

	getSpanRange(): Range {
		return this.spanRange || this.getNameRange();
	}

	getTooltip(): string {
		if (this.baseType) {
			return this.getQualifiedName() + `<${this.baseType.getTooltip()}>`;
		}
		return super.getTooltip();
	}

	getTypeText(): string {
		if (this.baseType) {
			return this.getName() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getName();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
		if (this.baseType) {
			return this.baseType.getSymbolAtPos(position);
		}
		return undefined;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		// In some cases where a variable declaration is declaring multiple properties we may already have initialized a reference.
		// e.g. "local float x, y, z;"
		if (this.reference) {
			return;
		}

		const id = this.getId();
		let symbol: ISymbol;

		switch (this.typeKind) {
			case UCTypeKind.Class: {
				// TODO: flatten this look up by using a globally defined classesMap.
				symbol = SymbolsTable.findSymbol(id, true);
				break;
			}

			case UCTypeKind.State: case UCTypeKind.Function: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			case UCTypeKind.Struct: case UCTypeKind.Enum: {
				// FIXME: Should use findSuperSymbol,
				// - so that we can match invalid(non-types) symbols, and produce a useful error.
				// - This however would effect the programs performance.
				// - In fact, a struct extending a CLASS will crash the compiler, but produce no useful warning at all.
				// - So should we match a symbol using the global table?.
				symbol = context.findTypeSymbol(id, true);
				break;
			}

			default: {
				// Quick shortcut for the most common types or top level symbols.
				symbol = CORE_PACKAGE.findSymbol(id, false)
					// Note: Classes have to be compared first!
					|| SymbolsTable.findSymbol(id, true)
					|| context.findTypeSymbol(id, true);
			}
		}

		if (symbol) {
			this.setReference(symbol, document);
		}

		if (this.baseType) {
			this.baseType.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		const symbol = this.getReference();
		if (symbol) {
			if (this.baseType) {
				this.baseType.analyze(document, context);
			}

			switch (this.typeKind) {
				case UCTypeKind.Class: {
					if (!(symbol instanceof UCClassSymbol)) {
						document.nodes.push(new SemanticErrorNode(this, `Expected a class!`));
					}
					break;
				}

				case UCTypeKind.State: {
					if (!(symbol instanceof UCStateSymbol)) {
						document.nodes.push(new SemanticErrorNode(this, `Expected a state!`));
					}
					break;
				}

				case UCTypeKind.Function: {
					if (!(symbol instanceof UCMethodSymbol)) {
						document.nodes.push(new SemanticErrorNode(this, `Expected a function!`));
					}
					break;
				}

				case UCTypeKind.Enum: {
					if (!(symbol instanceof UCEnumSymbol)) {
						document.nodes.push(new SemanticErrorNode(this, `Expected an enum!`));
					}
					break;
				}

				case UCTypeKind.Struct: {
					if (!(symbol instanceof UCScriptStructSymbol)) {
						document.nodes.push(new SemanticErrorNode(this, `Expected a struct!`));
					}
					break;
				}
			}
			return;
		}

		document.nodes.push(new UnrecognizedTypeNode(this));
	}
}