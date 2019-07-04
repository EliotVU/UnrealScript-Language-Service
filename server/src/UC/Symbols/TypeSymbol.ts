import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import { UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';

import {
	UCSymbol, UCSymbolReference,
	UCStructSymbol, UCClassSymbol, UCStateSymbol, UCScriptStructSymbol,
	UCFieldSymbol, UCEnumSymbol,
	PackagesTable, SymbolsTable,
	ISymbol, Identifier, IWithReference,
	PredefinedByte, PredefinedFloat, PredefinedString,
	PredefinedBool, PredefinedButton, PredefinedName,
	PredefinedInt, PredefinedPointer
} from '.';

export enum UCTypeKind {
	// PRIMITIVE TYPES
	Float,
	// Also true for a pointer
	Int,
	// Also true for an enum member.
	Byte,
	String,
	Name,
	Bool,

	// OBJECT TYPES
	// i.e. "Enum'ENetRole'"
	Object,
	// For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Package,
	// A class like class<CLASSNAME>.
	Class,
	Interface,
	Enum,
	State,
	Struct,
	Property,
	Function,
	Delegate,

	// Special case for property type validations.
	Type,

	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None,

	// A type that couldn't be found.
	Error
}

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
	getTypeKind(): UCTypeKind;

	index(document: UCDocument, context?: UCStructSymbol);
	analyze(document: UCDocument, context?: UCStructSymbol);
}

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedTypeSymbol extends UCSymbol implements ITypeSymbol {
	constructor(private type: UCObjectTypeSymbol, private left?: UCQualifiedTypeSymbol) {
		super(type.id);
	}

	getTypeText(): string {
		return this.type.getTypeText();
	}

	getTypeKind(): UCTypeKind {
		return this.type.getTypeKind();
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

export abstract class UCPredefinedTypeSymbol extends UCSymbol implements IWithReference {
	getReference(): ISymbol {
		throw "not implemented";
	}

	getTooltip(): string {
		return this.getReference().getTooltip();
	}

	getTypeText(): string {
		return this.getReference().getId().toString();
	}

	getSymbolAtPos(position: Position) {
		if (intersectsWithRange(position, this.id.range)) {
			return this;
		}
	}
}

export class UCByteTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedByte;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Byte;
	}
}

export class UCFloatTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedFloat;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Float;
	}
}

export class UCIntTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedInt;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
	}
}

export class UCStringTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedString;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.String;
	}
}

export class UCNameTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedName;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Name;
	}
}

export class UCBoolTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedBool;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Bool;
	}
}

export class UCPointerTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedPointer;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
	}
}

export class UCButtonTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedButton;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Byte;
	}
}

export class UCObjectTypeSymbol extends UCSymbolReference implements ITypeSymbol {
	public baseType?: ITypeSymbol;

	constructor(id: Identifier, private range: Range = id.range, private validTypeKind?: UCTypeKind) {
		super(id);
	}

	getTypeText(): string {
		if (this.baseType) {
			return this.getId() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getId().toString();
	}

	getTypeKind(): UCTypeKind {
		// TODO: UCInterfaceSymbol, anyother symbol is not a valid reference for this type symbol (in property declarations).
		// Should we create a UCStructTypeSymbol and UCStateTypeSymbol in particular for a state, and struct extends clause?
		if (this.reference instanceof UCClassSymbol) {
			return this.baseType
				? UCTypeKind.Class
				: UCTypeKind.Object;
		} else if (this.reference instanceof UCScriptStructSymbol) {
			return UCTypeKind.Struct;
		} else if (this.reference instanceof UCEnumSymbol) {
			return UCTypeKind.Enum;
		}
		return UCTypeKind.Error;
	}

	setValidTypeKind(kind: UCTypeKind) {
		this.validTypeKind = kind;
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
		switch (this.validTypeKind) {
			case UCTypeKind.Package: {
				symbol = PackagesTable.findSymbol(id, false);
				break;
			}

			case UCTypeKind.Class: case UCTypeKind.Interface: {
				symbol = SymbolsTable.findSymbol(id, true);
				break;
			}

			case UCTypeKind.Enum: case UCTypeKind.Struct: case UCTypeKind.State: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			default: {
				// First try to match upper level symbols such as a class.
				symbol = SymbolsTable.findSymbol(id, true) || context.findSuperSymbol(id);
			}
		}

		if (this.validTypeKind === UCTypeKind.Type) {
			if (!(symbol instanceof UCFieldSymbol && symbol.isType())) {
				symbol = undefined;
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
		if (!symbol) {
			document.nodes.push(new UnrecognizedTypeNode(this));
			return;
		}

		switch (this.validTypeKind) {
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
	}
}

export class UCArrayTypeSymbol extends UCObjectTypeSymbol {

}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {

}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {

}