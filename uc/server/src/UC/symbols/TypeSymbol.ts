import { Position, Range } from 'vscode-languageserver-types';

import { QualifiedIdentifierContext } from '../../antlr/UCGrammarParser';

import { UCDocument } from '../document';
import { UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';

import {
	UCSymbol,
	UCSymbolReference,
	UCPackage,
	UCStructSymbol,
	UCClassSymbol,
	UCStateSymbol,
	UCScriptStructSymbol,
	UCMethodSymbol,
	UCEnumSymbol,
	SymbolsTable,
} from '.';
import { UCTypeKind } from './TypeKind';
import { ISymbol, Identifier } from './ISymbol';

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedType extends UCSymbol {
	public left?: UCQualifiedType;
	public type: UCTypeSymbol;

	getTooltip(): string {
		return this.type.getTooltip();
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.left) {
			const symbol = this.left.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return this.type.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		this.left && this.left.index(document, context);
		this.type.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		this.left && this.left.analyze(document, context);
		this.type.analyze(document, context);
	}

	visit(ctx: QualifiedIdentifierContext) {
		this.context = ctx;
	}
}

export class UCTypeSymbol extends UCSymbolReference {
	public baseType?: UCTypeSymbol;

	constructor(id: Identifier, private range: Range = id.range, private typeKind?: UCTypeKind) {
		super(id);
	}

	setTypeKind(kind: UCTypeKind) {
		this.typeKind = kind;
	}

	getRange(): Range {
		return this.range;
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

	getContainedSymbolAtPos(position: Position) {
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
		let symbol: ISymbol | undefined;
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
				symbol = context.findTypeSymbol(id);
				break;
			}

			default: {
				// First try to match upper level symbols such as a class.
				symbol = SymbolsTable.findSymbol(id, true) || context.findTypeSymbol(id);
			}
		}

		if (symbol) {
			// Ignore, never match a package when a type is expected,
			// but we'd like to keep the package match in @findSymbol, so that we can properly link object literals.
			if (symbol instanceof UCPackage) {
				return;
			}
			this.setReference(symbol, document);
		}

		if (this.baseType) {
			this.baseType.index(document, context);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.baseType) {
			this.baseType.analyze(document, context);
		}

		const symbol = this.getReference();
		if (symbol) {
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