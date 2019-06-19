import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';
import { NAME_BYTE, NAME_FLOAT, NAME_STRING, NAME_BOOL, NAME_BUTTON, NAME_NAME, NAME_INT, NAME_POINTER } from '../names';

import {
	UCSymbol,
	UCSymbolReference,
	UCStructSymbol,
	UCClassSymbol,
	UCStateSymbol,
	UCScriptStructSymbol,
	UCMethodSymbol,
	UCEnumSymbol,
	PackagesTable, SymbolsTable,
	ISymbol, Identifier, IWithReference,
	UCTypeKind
} from '.';
import {
	PredefinedByte, PredefinedFloat, PredefinedString,
	PredefinedBool, PredefinedButton, PredefinedName,
	PredefinedInt, PredefinedPointer
} from '.';
import { UCNativeType } from './NativeType';

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
}

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedTypeSymbol extends UCSymbol implements ITypeSymbol {
	constructor(private type: UCTypeSymbol, private left?: UCQualifiedTypeSymbol) {
		super(type.id);
	}

	public getTypeText(): string {
		return this.type.getTypeText();
	}

	getReference(): ISymbol | undefined {
		return this.type.getReference();
	}

	getTooltip(): string {
		return this.type.getTooltip();
	}

	getSymbolAtPos(position: Position) {
		return this.getContainedSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.left) {
			const symbol = this.left.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return this.type.getReference() && this.type.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.left) {
			this.left.index(document, context);
			const leftContext = this.left.getReference();
			context = leftContext as UCStructSymbol;
		}

		this.type.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) {
			this.left.analyze(document, context);
			const leftContext = this.left.getReference();
			context = leftContext as UCStructSymbol;
		}

		this.type.analyze(document, context);
	}
}

export class UCPredefinedTypeSymbol extends UCSymbolReference implements ITypeSymbol {
	public getTypeText(): string {
		return this.getId().toString();
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		let symbol: UCNativeType | undefined = undefined;

		switch (this.getId()) {
			case NAME_BYTE:
				symbol = PredefinedByte;
				break;
			case NAME_FLOAT:
				symbol = PredefinedFloat;
				break;
			case NAME_INT:
				symbol = PredefinedInt;
				break;
			case NAME_STRING:
				symbol = PredefinedString;
				break;
			case NAME_NAME:
				symbol = PredefinedName;
				break;
			case NAME_BOOL:
				symbol = PredefinedBool;
				break;
			case NAME_POINTER:
				symbol = PredefinedPointer;
				break;
			case NAME_BUTTON:
				symbol = PredefinedButton;
				break;
		}

		this.setReference(symbol!, document);
	}
}

export class UCTypeSymbol extends UCSymbolReference implements ITypeSymbol {
	public baseType?: UCTypeSymbol;

	constructor(id: Identifier, private range: Range = id.range, private typeKind?: UCTypeKind) {
		super(id);
	}

	public getTypeText(): string {
		if (this.baseType) {
			return this.getId() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getId().toString();
	}

	setTypeKind(kind: UCTypeKind) {
		this.typeKind = kind;
	}

	getRange(): Range {
		return this.range;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.baseType && this.baseType.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		// In some cases where a variable declaration is declaring multiple properties we may already have initialized a reference.
		// e.g. "local float x, y, z;"
		if (this.reference || !context) {
			return;
		}

		const id = this.getId();
		let symbol: ISymbol | undefined;
		switch (this.typeKind) {
			case UCTypeKind.Package: {
				symbol = PackagesTable.findSymbol(id, false);
				break;
			}

			case UCTypeKind.Class: {
				symbol = SymbolsTable.findSymbol(id, true);
				break;
			}

			case UCTypeKind.Struct: case UCTypeKind.State: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			default: {
				// First try to match upper level symbols such as a class.
				symbol = SymbolsTable.findSymbol(id, true) || context.findSuperSymbol(id);
			}
		}

		symbol && this.setReference(symbol, document);
		this.baseType && this.baseType.index(document, context);
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