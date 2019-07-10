import { Position, Range, Location } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange, intersectsWith } from '../helpers';
import { UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';

import {
	UCSymbol, UCStructSymbol, UCClassSymbol,
	UCStateSymbol, UCScriptStructSymbol,
	UCFieldSymbol, UCEnumSymbol,
	PackagesTable, SymbolsTable,
	ISymbol, Identifier, IWithReference,
	PredefinedByte, PredefinedFloat, PredefinedString,
	PredefinedBool, PredefinedButton, PredefinedName,
	PredefinedInt, PredefinedPointer, NativeClass,
	ISymbolContext, ISymbolReference
} from '.';

export enum UCTypeFlags {
	// A type that couldn't be found.
	Error			= 0,

	// PRIMITIVE TYPES
	Float 			= 1 << 1,
	Int 			= 1 << 2, // Also true for a pointer
	Byte 			= 1 << 3, // Also true for an enum member.
	String			= 1 << 4,
	Name			= 1 << 5,
	Bool			= 1 << 6,
	Array			= 1 << 7,
	Delegate		= 1 << 8,

	// OBJECT TYPES
	Object			= 1 << 9,
	Package			= 1 << 10 | Object, // For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Class			= 1 << 11 | Object, // A class like class<CLASSNAME>.
	Interface		= 1 << 12 | Object,
	Enum			= 1 << 13 | Object,
	Struct			= 1 << 14 | Object,
	Property		= 1 << 15 | Object,
	Function		= 1 << 16 | Object,
	State			= 1 << 17 | Object,

	// Special case for property type validations.
	Type			= Object | Class | Interface | Enum | Struct,
	NumberCoerce	= Float | Int | Byte,
	EnumCoerce		= Int | Byte,

	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None			= 1 << 18
}

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
	getTypeFlags(): UCTypeFlags;

	index(document: UCDocument, context?: UCStructSymbol);
	analyze(document: UCDocument, context?: UCStructSymbol);
}

export function isTypeSymbol(symbol: ITypeSymbol): symbol is ITypeSymbol {
	return 'getTypeFlags' in symbol;
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

	getTypeFlags(): UCTypeFlags {
		return this.type.getTypeFlags();
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

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}
}

export class UCFloatTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedFloat;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Float;
	}
}

export class UCIntTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedInt;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}
}

export class UCStringTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedString;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.String;
	}
}

export class UCNameTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedName;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Name;
	}
}

export class UCBoolTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedBool;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Bool;
	}
}

export class UCPointerTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedPointer;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}
}

export class UCButtonTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedButton;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}
}

export class UCObjectTypeSymbol extends UCSymbol implements ITypeSymbol {
	protected reference?: ISymbol | ITypeSymbol;

	public baseType?: ITypeSymbol;

	constructor(id: Identifier, private range: Range = id.range, private validTypeKind?: UCTypeFlags) {
		super(id);
	}

	getRange(): Range {
		return this.range;
	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.reference && intersectsWithRange(position, this.id.range)) {
			return this;
		}
		return this.baseType && this.baseType.getSymbolAtPos(position);
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getTooltip();
		}
		return '';
	}

	getTypeText(): string {
		if (this.baseType) {
			return this.getId() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getId().toString();
	}

	getTypeFlags(): UCTypeFlags {
		if (this.reference !== NativeClass && this.reference instanceof UCClassSymbol) {
			return UCTypeFlags.Object;
		}
		return this.reference instanceof UCFieldSymbol && this.reference.getTypeFlags() || UCTypeFlags.Error;
	}

	setValidTypeKind(kind: UCTypeFlags) {
		this.validTypeKind = kind;
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
			case UCTypeFlags.Package: {
				symbol = PackagesTable.findSymbol(id, false);
				break;
			}

			case UCTypeFlags.Class: case UCTypeFlags.Interface: {
				symbol = SymbolsTable.findSymbol(id, true);
				break;
			}

			case UCTypeFlags.Enum: case UCTypeFlags.Struct: case UCTypeFlags.State: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			default: {
				// First try to match upper level symbols such as a class.
				symbol = SymbolsTable.findSymbol(id, true) || context.findSuperSymbol(id);
			}
		}

		if (this.validTypeKind === UCTypeFlags.Type) {
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
			case UCTypeFlags.Class: {
				if (!(symbol instanceof UCClassSymbol)) {
					document.nodes.push(new SemanticErrorNode(this, `Expected a class!`));
				}
				break;
			}

			case UCTypeFlags.State: {
				if (!(symbol instanceof UCStateSymbol)) {
					document.nodes.push(new SemanticErrorNode(this, `Expected a state!`));
				}
				break;
			}

			case UCTypeFlags.Enum: {
				if (!(symbol instanceof UCEnumSymbol)) {
					document.nodes.push(new SemanticErrorNode(this, `Expected an enum!`));
				}
				break;
			}

			case UCTypeFlags.Struct: {
				if (!(symbol instanceof UCScriptStructSymbol)) {
					document.nodes.push(new SemanticErrorNode(this, `Expected a struct!`));
				}
				break;
			}
		}
	}

	setReference(symbol: ISymbol, document: UCDocument, context?: ISymbolContext, noIndex?: boolean, range: Range = this.id.range) {
		this.reference = symbol;
		if (noIndex) {
			return;
		}

		if (symbol && symbol instanceof UCSymbol) {
			const ref: ISymbolReference = {
				location: Location.create(document.filePath, range),
				symbol: this,
				context
			};
			document.indexReference(symbol, ref);
		}
	}

	getReference(): ISymbol | undefined {
		return this.reference;
	}
}

export class UCArrayTypeSymbol extends UCObjectTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Array;
	}
}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Delegate;
	}
}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}
}