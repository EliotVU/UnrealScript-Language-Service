import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import {
    Name, NAME_ARRAY, NAME_BOOL, NAME_BUTTON, NAME_BYTE, NAME_DELEGATE, NAME_FLOAT, NAME_INT,
    NAME_MAP, NAME_NAME, NAME_NONE, NAME_OBJECT, NAME_POINTER, NAME_RANGE, NAME_ROTATOR,
    NAME_STRING, NAME_VECTOR
} from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_RANGE, Identifier, ISymbol, IWithReference, NativeArray, ObjectsTable, UCConstSymbol,
    UCFieldSymbol, UCMethodSymbol, UCParamSymbol, UCScriptStructSymbol, UCStructSymbol, UCSymbol,
    UCSymbolReference
} from './';
import { tryFindClassSymbol, tryFindSymbolInPackage, UCPackage } from './Package';
import { UCPropertySymbol } from './PropertySymbol';
import { UCStateSymbol } from './StateSymbol';

export enum UCTypeFlags {
	// A type that couldn't be found or resolved.
	Error			    = 0,

	// PRIMITIVE TYPES
	Float 			    = 1 << 1,
	Int 			    = 1 << 2, // Also true for a pointer
	Byte 			    = 1 << 3, // Also true for an enum member.
    EnumMember		    = Byte,
	String			    = 1 << 4,
	Name			    = 1 << 5,
	Bool			    = 1 << 6,
	Array			    = 1 << 7,
    // Also used to flag functions of the delegate type
	Delegate		    = 1 << 8,

	// OBJECT TYPES
    // TODO: Deprecate | Object, as this complicates things too much
	Object			    = 1 << 9,
	Archetype 		    = 1 << 10 | Object,
	Package			    = 1 << 11 | Object, // For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Class			    = 1 << 12 | Object, // A class like class<CLASSNAME>.
	Interface		    = 1 << 13,
	Enum			    = 1 << 14 | Object,
	Struct			    = 1 << 15 | Object,
	Property		    = 1 << 16 | Object,
	Function		    = 1 << 17 | Object,
	State			    = 1 << 18 | Object,
	Const			    = 1 << 19 | Object,

	// Special case for property type validations.
	Type			    = 1 << 20,
	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None			    = 1 << 21,

    NamedFlags          = (None | Class | Delegate | Function
                        | Array | Bool | Name
                        | String | Byte | Int
                        | Float | Archetype
                        | Error) & ~(Object)
}

export const NumberCoerceFlags	        = UCTypeFlags.Float | UCTypeFlags.Int | UCTypeFlags.Byte | UCTypeFlags.Bool;
export const EnumCoerceFlags		    = UCTypeFlags.Enum | UCTypeFlags.Int | UCTypeFlags.Byte;

// "None" can be passed to...
export const NoneCoerceFlags		    = UCTypeFlags.Delegate | UCTypeFlags.Object | UCTypeFlags.Name;

// TODO: Verify if "coerce" is required when passing a "Name" to a "String" type.
export const NameCoerceFlags		    = UCTypeFlags.Name | UCTypeFlags.String;

// Can be coerced to type "String", if marked with "coerce".
export const CoerceToStringFlags	    = UCTypeFlags.Name | UCTypeFlags.String | UCTypeFlags.Object | NumberCoerceFlags | UCTypeFlags.Bool | UCTypeFlags.None;

// Types that can be assigned to by an identifier literal.
export const AssignableByIdentifierFlags    = (EnumCoerceFlags | UCTypeFlags.Class | UCTypeFlags.Archetype | UCTypeFlags.Delegate) & ~Object;
export const ObjectTypeFlags                = UCTypeFlags.Object;
export const ReplicatableTypeFlags          = (UCTypeFlags.Function | UCTypeFlags.Property) & ~UCTypeFlags.Object;
export const AssignToDelegateFlags          = UCTypeFlags.Delegate | (UCTypeFlags.Function & ~UCTypeFlags.Object) | UCTypeFlags.None;

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
	getTypeFlags(): UCTypeFlags;

	index(document: UCDocument, context?: UCStructSymbol): void;
}

export function isTypeSymbol(symbol: ITypeSymbol): symbol is ITypeSymbol {
	return 'getTypeFlags' in symbol;
}

export function getTypeFlagsName(type?: ITypeSymbol): string {
    const flags = type?.getTypeFlags() || UCTypeFlags.Error;
	return UCTypeFlags[flags & UCTypeFlags.NamedFlags];
}

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedTypeSymbol extends UCSymbol implements ITypeSymbol {
	constructor(public type: UCObjectTypeSymbol, public left?: UCQualifiedTypeSymbol) {
		super(type.id);
	}

    static is(symbol: ISymbol): symbol is UCQualifiedTypeSymbol {
        return symbol.hasOwnProperty('type');
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

	override getSymbolAtPos(position: Position) {
		return this.getContainedSymbolAtPos(position);
	}

	override getContainedSymbolAtPos(position: Position): ISymbol | undefined {
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

    getTooltip(): string {
		return this.id.name === NAME_NAME
            ? 'type ' + this.id.name
            : `'${this.id.name}'`;
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

    static is(symbol: ISymbol): symbol is UCObjectTypeSymbol {
        return symbol.hasOwnProperty('baseType');
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
		// if (this.reference !== NativeClass && this.reference instanceof UCClassSymbol) {
		// 	return UCTypeFlags.Object;
		// }
		return this.reference
            && isFieldSymbol(this.reference)
            && this.reference.getTypeFlags()
            || UCTypeFlags.Error;
	}

	getValidTypeKind(): UCTypeFlags {
		return this.validTypeKind || UCTypeFlags.Error;
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

			case UCTypeFlags.Class: {
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

    static is(symbol: ISymbol): symbol is UCArrayTypeSymbol {
        return (symbol.getTypeFlags() & UCTypeFlags.Array) !== 0;
    }

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

    static is(symbol: ISymbol): symbol is UCArrayTypeSymbol {
        return (symbol.getTypeFlags() & UCTypeFlags.Delegate | (UCTypeFlags.Function & ~UCTypeFlags.Object)) === UCTypeFlags.Delegate;
    }

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

// TODO: Handle class hierarchy
// TODO: Handle coercing
export function typeMatchesFlags(type: ITypeSymbol | undefined, expectedType: ITypeSymbol, coerce: boolean = false): boolean {
	if (expectedType.getTypeFlags() === UCTypeFlags.Error) {
		return false;
	}

	if (typeof type === 'undefined') {
	    return false;
    }

    const expectedFlags = expectedType.getTypeFlags();
    const flags = type.getTypeFlags();
    if (coerce && expectedFlags & UCTypeFlags.String) {
        return (flags & CoerceToStringFlags) !== 0;
    }

    if ((flags & NumberCoerceFlags) !== 0) {
        return (expectedFlags & NumberCoerceFlags) !== 0 || (expectedFlags & UCTypeFlags.Enum) === UCTypeFlags.Enum;
    } else if ((flags & UCTypeFlags.Enum) === UCTypeFlags.Enum) {
        return (expectedFlags & EnumCoerceFlags) !== 0;
    } else if (flags === UCTypeFlags.None) {
        return (expectedFlags & NoneCoerceFlags) !== 0;
    } else if (flags === UCTypeFlags.String) {
        return (expectedFlags & UCTypeFlags.String) !== 0;
    } else if (flags === UCTypeFlags.Name) {
        return (expectedFlags & UCTypeFlags.Name | (UCTypeFlags.String*Number(coerce))) !== 0;
    } else if ((flags & UCTypeFlags.Struct) === UCTypeFlags.Struct) {
        return (expectedFlags & UCTypeFlags.Struct) === UCTypeFlags.Struct
            && expectedType.getName() === type.getName();
    } else if (flags & UCTypeFlags.Delegate) {
        return (expectedFlags & UCTypeFlags.Delegate) !== 0;
    }
    if ((flags & ObjectTypeFlags) !== 0) {
        if ((expectedFlags & UCTypeFlags.Struct) === UCTypeFlags.Struct) {
            return false;
        }
        if (expectedFlags & UCTypeFlags.Delegate) {
            return (flags & AssignToDelegateFlags) !== 0;
        }
        return (expectedFlags & ObjectTypeFlags) !== 0;
    }
    return flags === expectedFlags;
}

/** Resolves a type to its base type if set. e.g. "Class<Actor>" would be resolved to "Actor". */
export function resolveType(type?: ITypeSymbol): ITypeSymbol | undefined {
    const resolveToBase = UCTypeFlags.Object | UCTypeFlags.Delegate;
	if (type && (type.getTypeFlags() & resolveToBase) !== 0 && hasDefinedBaseType(type)) {
		return type.baseType;
	}
	return type;
}

export function hasDefinedBaseType(type: ITypeSymbol & { baseType?: ITypeSymbol | undefined }): type is UCObjectTypeSymbol & { baseType: ITypeSymbol } {
    return typeof type.baseType !== 'undefined';
}

export function hasChildren(symbol: ISymbol): symbol is UCStructSymbol {
    return symbol instanceof UCStructSymbol;
}

export function isFieldSymbol(symbol: ISymbol): symbol is UCFieldSymbol {
    return symbol.hasOwnProperty('modifiers');
}

export function isConstSymbol(symbol: ISymbol): symbol is UCConstSymbol {
    return (symbol.getTypeFlags() & UCTypeFlags.Const & ~UCTypeFlags.Object) !== 0;
}

export function isPropertySymbol(symbol: ISymbol): symbol is UCPropertySymbol {
    return (symbol.getTypeFlags() & UCTypeFlags.Property & ~UCTypeFlags.Object) !== 0;
}

export function isParamSymbol(symbol: ISymbol): symbol is UCParamSymbol {
    return symbol.hasOwnProperty('paramModifiers');
}

export function isScriptStructSymbol(symbol: ISymbol): symbol is UCScriptStructSymbol {
    return (symbol.getTypeFlags() & UCTypeFlags.Struct & ~UCTypeFlags.Object) !== 0;
}

export function isMethodSymbol(symbol: ISymbol): symbol is UCMethodSymbol {
    return (symbol.getTypeFlags() & UCTypeFlags.Function & ~UCTypeFlags.Object) !== 0;
}

export function isStateSymbol(symbol: ISymbol): symbol is UCStateSymbol {
    return (symbol.getTypeFlags() & UCTypeFlags.State & ~UCTypeFlags.Object) !== 0;
}