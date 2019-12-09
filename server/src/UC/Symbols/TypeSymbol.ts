import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import { SymbolWalker } from '../symbolWalker';
import { ErrorDiagnostic } from '../diagnostics/diagnostic';

import {
	ISymbol, Identifier, IWithReference,
	UCSymbol, UCSymbolReference,
	UCStructSymbol, UCClassSymbol, UCFieldSymbol,
	NativeClass, ObjectsTable, DEFAULT_RANGE, NativeArray
} from '.';
import {
	NAME_NONE, Name, NAME_BYTE, NAME_FLOAT, NAME_INT, NAME_STRING,
	NAME_NAME, NAME_BOOL, NAME_POINTER, NAME_BUTTON, NAME_OBJECT,
	NAME_VECTOR, NAME_ROTATOR, NAME_RANGE, NAME_DELEGATE,
	NAME_ARRAY, NAME_MAP
} from '../names';
import { UCPackage, tryFindClassSymbol, tryFindSymbolInPackage } from './Package';
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
	Archetype 		= 1 << 10 | Object,
	Package			= 1 << 11 | Object, // For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Class			= 1 << 12 | Object, // A class like class<CLASSNAME>.
	Interface		= 1 << 13 | Object,
	Enum			= 1 << 14 | Object,
	Struct			= 1 << 15 | Object,
	Property		= 1 << 16 | Object,
	Function		= 1 << 17 | Object,
	State			= 1 << 18 | Object,
	Const			= 1 << 19 | Object,

	// Special case for property type validations.
	Type			= 1 << 20,
	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None			= 1 << 21,

	NumberCoerce	= Float | Int | Byte,
	EnumCoerce		= Enum | Int | Byte,
	NoneCoerce		= Delegate | Object | Name,

	// TODO: Verify if "coerce" is required when passing a "Name" to a "String" type.
	NameCoerce		= Name | String,

	// Can be coerced to type "String", if marked with "coerce".
	CoerceString	= Name | String | Object | NumberCoerce | Bool | None,

	Replicatable	= Function | Property,

	// Types that can be assigned to by an identifier literal.
	IdentifierTypes = EnumCoerce | Class | Delegate
}

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
	getTypeFlags(): UCTypeFlags;

	index(document: UCDocument, context?: UCStructSymbol);
}

export function isTypeSymbol(symbol: ITypeSymbol): symbol is ITypeSymbol {
	return 'getTypeFlags' in symbol;
}

export function getTypeFlagsName(type?: ITypeSymbol): string {
	return UCTypeFlags[type?.getTypeFlags() || UCTypeFlags.Error];
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

	getRef(): ISymbol | undefined {
		return this.type.getRef();
	}

	getTooltip(): string {
		return this.type.getTooltip();
	}

	getSymbolAtPos(position: Position) {
		return this.getContainedSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.left?.getSymbolAtPos(position) || this.type.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.left) {
			this.left.index(document, context);
			const leftContext = this.left.getRef();
			if (!leftContext) {
				// We don't want to index type in this case, so that we don't match a false positive,
				// -- where say package was not found, but its member is (in another package).
				return;
			}

			// Ensure that context will never be anything but instances of these. e.g. class'PROP.subfield' where PROP is neither a package nor a struct.
			if (leftContext instanceof UCStructSymbol || leftContext instanceof UCPackage) {
				context = leftContext as UCStructSymbol;
			}
		}

		this.type.index(document, context);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitQualifiedType(this);
	}
}

export class UCPredefinedTypeSymbol extends UCSymbol implements ITypeSymbol {
	getRef(): ISymbol | undefined {
		return undefined;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}

	getTooltip(): string {
		return 'type ' + this.id.name;
	}

	getTypeText(): string {
		return this.id.name.toString();
	}

	getSymbolAtPos(position: Position) {
		if (intersectsWithRange(position, this.id.range)) {
			return this;
		}
	}

	static getStaticName(): Name {
		return NAME_NONE;
	}
}

export class UCByteTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}

	static getStaticName(): Name {
		return NAME_BYTE;
	}
}

export class UCFloatTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Float;
	}

	static getStaticName(): Name {
		return NAME_FLOAT;
	}
}

export class UCIntTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	static getStaticName(): Name {
		return NAME_INT;
	}
}

export class UCStringTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.String;
	}

	static getStaticName(): Name {
		return NAME_STRING;
	}
}

export class UCNameTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Name;
	}

	static getStaticName(): Name {
		return NAME_NAME;
	}
}

export class UCBoolTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Bool;
	}

	static getStaticName(): Name {
		return NAME_BOOL;
	}
}

export class UCPointerTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	static getStaticName(): Name {
		return NAME_POINTER;
	}
}

export class UCButtonTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}

	static getStaticName(): Name {
		return NAME_BUTTON;
	}
}

export class UCNoneTypeSymbol extends UCPredefinedTypeSymbol {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.None;
	}

	static getStaticName(): Name {
		return NAME_NONE;
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
		// We don't want to provide hover info when we have no resolved reference.
		if (this.reference && intersectsWithRange(position, this.id.range)) {
			return this;
		}
		return this.baseType?.getSymbolAtPos(position);
	}

	getTooltip(): string {
		if (this.reference instanceof UCSymbol) {
			return this.reference.getTooltip();
		}
		return '';
	}

	getTypeText(): string {
		if (this.baseType) {
			return this.getName() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getName().toString();
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
		this.baseType?.index(document, context);

		// In some cases where a variable declaration is declaring multiple properties we may already have initialized a reference.
		// e.g. "local float x, y, z;"
		if (this.reference || !context) {
			return;
		}

		const id = this.getName();
		let symbol: ISymbol | undefined;
		switch (this.validTypeKind) {
			case UCTypeFlags.Package: {
				symbol = ObjectsTable.getSymbol<UCPackage>(id, UCTypeFlags.Package);
				break;
			}

			case UCTypeFlags.Class: case UCTypeFlags.Interface: {
				symbol = tryFindClassSymbol(id);
				break;
			}

			case UCTypeFlags.Enum: case UCTypeFlags.Struct: {
				symbol = ObjectsTable.getSymbol<UCStructSymbol>(id, this.validTypeKind);
				break;
			}

			case UCTypeFlags.State: case UCTypeFlags.Delegate: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			// Either a class, struct, or enum
			case UCTypeFlags.Type: {
				symbol = tryFindClassSymbol(id) || ObjectsTable.getSymbol(id);
				break;
			}

			default:
				if (context instanceof UCStructSymbol) {
					symbol = context.findSuperSymbol(id);
				} else if (context as unknown instanceof UCPackage) {
					symbol = tryFindSymbolInPackage(id, context);
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
		return 'type Array';
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Array;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitArrayType(this);
	}
}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {
	reference = StaticDelegateType;

	getTooltip(): string {
		return 'type Delegate';
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Delegate;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDelegateType(this);
	}
}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {
	reference = StaticMapType;

	getTooltip(): string {
		return 'type Map';
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitMapType(this);
	}
}

export const CastTypeClassMap: Readonly<WeakMap<Name, typeof UCPredefinedTypeSymbol>> = new WeakMap([
	[NAME_BYTE, UCByteTypeSymbol],
	[NAME_FLOAT, UCFloatTypeSymbol],
	[NAME_INT, UCIntTypeSymbol],
	[NAME_STRING, UCStringTypeSymbol],
	[NAME_NAME, UCNameTypeSymbol],
	[NAME_BOOL, UCBoolTypeSymbol],
	// Oddly... conversion to a button is actually valid!
	[NAME_BUTTON, UCButtonTypeSymbol]
]);

export const StaticObjectType 	= new UCObjectTypeSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE }, DEFAULT_RANGE, UCTypeFlags.Class);
export const StaticArrayType 	= new UCArrayTypeSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });
export const StaticMapType 		= new UCMapTypeSymbol({ name: NAME_MAP, range: DEFAULT_RANGE });
export const StaticDelegateType = new UCDelegateTypeSymbol({ name: NAME_DELEGATE, range: DEFAULT_RANGE });
export const StaticIntType 		= new UCIntTypeSymbol({ name: NAME_INT, range: DEFAULT_RANGE });
export const StaticByteType 	= new UCByteTypeSymbol({ name: NAME_BYTE, range: DEFAULT_RANGE });
export const StaticFloatType 	= new UCFloatTypeSymbol({ name: NAME_FLOAT, range: DEFAULT_RANGE });
export const StaticBoolType 	= new UCBoolTypeSymbol({ name: NAME_BOOL, range: DEFAULT_RANGE });
export const StaticNameType 	= new UCNameTypeSymbol({ name: NAME_NAME, range: DEFAULT_RANGE });
export const StaticStringType 	= new UCStringTypeSymbol({ name: NAME_STRING, range: DEFAULT_RANGE });
export const StaticNoneType 	= new UCNoneTypeSymbol({ name: NAME_NONE, range: DEFAULT_RANGE });
export const StaticVectorType 	= new UCObjectTypeSymbol({ name: NAME_VECTOR, range: DEFAULT_RANGE });
export const StaticRotatorType 	= new UCObjectTypeSymbol({ name: NAME_ROTATOR, range: DEFAULT_RANGE });
export const StaticRangeType 	= new UCObjectTypeSymbol({ name: NAME_RANGE, range: DEFAULT_RANGE });

export const CastTypeSymbolMap: Readonly<WeakMap<Name, ITypeSymbol>> = new WeakMap([
	[NAME_BYTE, StaticByteType],
	[NAME_FLOAT, StaticFloatType],
	[NAME_INT, StaticIntType],
	[NAME_STRING, StaticStringType],
	[NAME_NAME, StaticNameType],
	[NAME_BOOL, StaticBoolType],
	// Oddly... conversion to a button is actually valid!
	[NAME_BUTTON, StaticBoolType]
]);

export function analyzeExpressionType(expression: IExpression, expected: UCTypeFlags) {
	const type = expression.getType();
	if (type && type.getTypeFlags() !== expected) {
		return new ErrorDiagnostic(expression.getRange()!,
			`Expected a type of '${UCTypeFlags[expected]}', but got type '${UCTypeFlags[type.getTypeFlags()]}'.`
		);
	}
}

export function typeMatchesFlags(type: ITypeSymbol | undefined, expected: UCTypeFlags): boolean {
	if (expected === UCTypeFlags.Error) {
		return false;
	}

	if (type) {
		const flags = type.getTypeFlags();
		if ((flags & UCTypeFlags.NumberCoerce) !== 0) {
			return (expected & UCTypeFlags.NumberCoerce) !== 0 || (expected & UCTypeFlags.Enum) === UCTypeFlags.Enum;
		} else if ((flags & UCTypeFlags.Enum) === UCTypeFlags.Enum) {
			return (expected & UCTypeFlags.EnumCoerce) !== 0;
		} else if (flags === UCTypeFlags.None) {
			return (expected & UCTypeFlags.NoneCoerce) !== 0;
		} else if (flags === UCTypeFlags.Name) {
			return (expected & UCTypeFlags.NameCoerce) !== 0;
		} else if ((flags & UCTypeFlags.Object) !== 0) {
			// TODO: Check for subclass?
			return (expected & UCTypeFlags.Object) !== 0;
		}
		return flags === expected;
	}
	return false;
}

/** Resolves a type to its base type if set. e.g. "Class<Actor>" would be resolved to "Actor". */
export function resolveType(type?: ITypeSymbol): ITypeSymbol | undefined {
	if (type && (type.getTypeFlags() & UCTypeFlags.Object) !== 0 && (type as UCObjectTypeSymbol).baseType) {
		return (type as UCObjectTypeSymbol).baseType;
	}
	return type;
}