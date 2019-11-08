import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import { SymbolWalker } from '../symbolWalker';
import { UnrecognizedTypeDiagnostic, ErrorDiagnostic } from '../diagnostics/diagnostic';

import {
	PackagesTable, ClassesTable,
	ISymbol, Identifier, IWithReference,
	UCSymbol, UCSymbolReference,
	UCStructSymbol, UCClassSymbol, UCFieldSymbol,
	TypeByte, TypeFloat, TypeString,
	TypeBool, TypeButton, TypeName,
	TypeInt, TypePointer,
	TypeArray, TypeDelegate, TypeMap,
	NativeClass, NativeArray, ObjectsTable
} from '.';
import { NAME_NONE, Name, NAME_BYTE, NAME_FLOAT, NAME_INT, NAME_STRING, NAME_NAME, NAME_BOOL, NAME_POINTER, NAME_BUTTON } from '../names';
import { UCPackage } from './Package';
import { IExpression } from '../expressions';

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
}

export function isTypeSymbol(symbol: ITypeSymbol): symbol is ITypeSymbol {
	return 'getTypeFlags' in symbol;
}

export function getTypeFlagsName(type: ITypeSymbol): string {
	return UCTypeFlags[type.getTypeFlags()];
}

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedTypeSymbol extends UCSymbol implements ITypeSymbol {
	constructor(public type: UCObjectTypeSymbol, public left?: UCQualifiedTypeSymbol) {
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

			// Ensure that context will never be anything but instances of these. e.g. class'PROP.subfield' where PROP is neither a package nor a struct.
			if (leftContext instanceof UCStructSymbol || leftContext instanceof UCPackage) {
				context = leftContext as UCStructSymbol;
			}
			// else do nothing? A warning might be convenient.
		}

		this.type.index(document, context);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		this.left && this.left.accept(visitor);
		return visitor.visitObjectType(this.type);
	}
}

export class UCPredefinedTypeSymbol extends UCSymbol implements IWithReference, ITypeSymbol {
	getReference(): ISymbol {
		throw "not implemented";
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
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

	static getName(): Name {
		return NAME_NONE;
	}
}

export class UCByteTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeByte;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}

	static getStaticName(): Name {
		return NAME_BYTE;
	}
}

export class UCFloatTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeFloat;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Float;
	}

	static getStaticName(): Name {
		return NAME_FLOAT;
	}
}

export class UCIntTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeInt;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	static getStaticName(): Name {
		return NAME_INT;
	}
}

export class UCStringTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeString;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.String;
	}

	static getStaticName(): Name {
		return NAME_STRING;
	}
}

export class UCNameTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeName;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Name;
	}

	static getStaticName(): Name {
		return NAME_NAME;
	}
}

export class UCBoolTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeBool;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Bool;
	}

	static getStaticName(): Name {
		return NAME_BOOL;
	}
}

export class UCPointerTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypePointer;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	static getStaticName(): Name {
		return NAME_POINTER;
	}
}

export class UCButtonTypeSymbol extends UCPredefinedTypeSymbol {
	getReference(): ISymbol {
		return TypeButton;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}

	static getStaticName(): Name {
		return NAME_BUTTON;
	}
}

export class UCObjectTypeSymbol extends UCSymbolReference implements ITypeSymbol {
	protected reference?: ISymbol;

	public baseType?: ITypeSymbol;

	constructor(id: Identifier, private range: Range = id.range, private validTypeKind?: UCTypeFlags) {
		super(id);
	}

	getRange(): Range {
		return this.range;
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

	getValidTypeKind(): UCTypeFlags | undefined {
		return this.validTypeKind;
	}

	setValidTypeKind(kind: UCTypeFlags) {
		this.validTypeKind = kind;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		// Don't move this below the reference return check,
		// because, we still want to index baseType for Predefined array/delegate types.
		this.baseType && this.baseType.index(document, context);

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
				symbol = ClassesTable.findSymbol(id, true);
				break;
			}

			case UCTypeFlags.Enum: case UCTypeFlags.Struct: {
				symbol = ObjectsTable.findSymbol(id);
				break;
			}

			case UCTypeFlags.State: case UCTypeFlags.Delegate: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			case UCTypeFlags.Type: {
				symbol = ClassesTable.findSymbol(id, true) || ObjectsTable.findSymbol(id);
				break;
			}

			// Special case for object literals like Property'Engine.Member.Member...'
			// FIXME: How to handle ambiguous literals such as class'Engine' versus class'Engine.Interactions',
			// -- where Engine either be the class or package named "Engine".
			case UCTypeFlags.Object: {
				symbol = PackagesTable.findSymbol(id)
					// TODO: Merge classes and objects, with tricky hashing so that we can filter by class type.
					|| ClassesTable.findSymbol(id, true)
					|| ObjectsTable.findSymbol(id)
					// FIXME: Hacky case for literals like Property'TempColor', only enums and structs are added to the objects table.
					|| context.findSuperSymbol(id);
				break;
			}

			default:
				// Dirty hack, UCPackage is not a type of UCStructSymbol,
				// -- handles cases like class'Engine.Interactions', where package 'Engine' is our context.
				if (context instanceof UCPackage) {
					symbol = context.findSymbol(id, true);
				} else {
					symbol = context.findSuperSymbol(id);
				}
				break;
		}
		symbol && this.setReference(symbol, document);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitObjectType(this);
	}
}

export class UCArrayTypeSymbol extends UCObjectTypeSymbol {
	reference = NativeArray;

	getTooltip(): string {
		return TypeArray.getTooltip();
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Array;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitArrayType(this);
	}
}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {
	reference = TypeDelegate;

	getTooltip(): string {
		return TypeDelegate.getTooltip();
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Delegate;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDelegateType(this);
	}
}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {
	reference = TypeMap;

	getTooltip(): string {
		return TypeMap.getTooltip();
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitMapType(this);
	}
}

// TODO: Deprecate this, but this is blocked by a lack of an analytical expression walker.
export function analyzeTypeSymbol(document: UCDocument, type: ITypeSymbol | UCSymbolReference) {
	if (type.getReference()) {
		return;
	}
	document.nodes.push(new UnrecognizedTypeDiagnostic(type));
}

export function analyzeExpressionType(expression: IExpression, expected: UCTypeFlags) {
	const type = expression.getType();
	if (type && type.getTypeFlags() !== expected) {
		return new ErrorDiagnostic(expression.getRange()!,
			`Expected a type of '${UCTypeFlags[expected]}', but got type '${UCTypeFlags[type.getTypeFlags()]}'.`
		);
	}
}

export function typeMatchesFlags(type: ITypeSymbol | undefined, expected: UCTypeFlags): boolean {
	if (type) {
		const flags = type.getTypeFlags();
		if ((flags & UCTypeFlags.Object) !== 0) {
			if (expected === UCTypeFlags.None) {
				return true;
			}
			return (expected & UCTypeFlags.Object) !== 0;
		} else if (flags === UCTypeFlags.Name) {
			if (expected === UCTypeFlags.None) {
				return true;
			}
		} else if ((flags & UCTypeFlags.NumberCoerce) !== 0) {
			return (expected & UCTypeFlags.NumberCoerce) !== 0;
		}
		return flags === expected;
	}
	return expected === UCTypeFlags.Error;
}