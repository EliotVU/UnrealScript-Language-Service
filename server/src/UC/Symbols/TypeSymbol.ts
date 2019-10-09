import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import { SymbolWalker } from '../symbolWalker';
import { UnrecognizedTypeNode } from '../diagnostics/diagnostic';

import {
	PackagesTable, ClassesTable,
	ISymbol, Identifier, IWithReference,
	UCSymbol, UCSymbolReference,
	UCStructSymbol, UCClassSymbol, UCFieldSymbol,
	PredefinedByte, PredefinedFloat, PredefinedString,
	PredefinedBool, PredefinedButton, PredefinedName,
	PredefinedInt, PredefinedPointer,
	PredefinedArray, PredefinedDelegate, PredefinedMap,
	NativeClass, NativeArray, ObjectsTable
} from '.';
import { NAME_NONE, Name, NAME_BYTE, NAME_FLOAT, NAME_INT, NAME_STRING, NAME_NAME, NAME_BOOL, NAME_POINTER, NAME_BUTTON } from '../names';
import { UCPackage } from './Package';

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
	Array,
	Delegate,

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

	// Special case for property type validations.
	Type,

	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None,

	// A type that couldn't be found.
	Error
}

// TODO: Deprecate this, but this is blocked by a lack of an analytical expression walker.
export function analyzeTypeSymbol(document: UCDocument, type: ITypeSymbol) {
	if (type.getReference()) {
		return;
	}
	document.nodes.push(new UnrecognizedTypeNode(type));
}

export interface ITypeSymbol extends UCSymbol, IWithReference {
	getTypeText(): string;
	getTypeKind(): UCTypeKind;

	index(document: UCDocument, context?: UCStructSymbol);
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

abstract class UCPredefinedTypeSymbol extends UCSymbol implements IWithReference {
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

	static getName(): Name {
		return NAME_NONE;
	}
}

export class UCByteTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedByte;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Byte;
	}

	static getStaticName(): Name {
		return NAME_BYTE;
	}
}

export class UCFloatTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedFloat;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Float;
	}

	static getStaticName(): Name {
		return NAME_FLOAT;
	}
}

export class UCIntTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedInt;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
	}

	static getStaticName(): Name {
		return NAME_INT;
	}
}

export class UCStringTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedString;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.String;
	}

	static getStaticName(): Name {
		return NAME_STRING;
	}
}

export class UCNameTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedName;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Name;
	}

	static getStaticName(): Name {
		return NAME_NAME;
	}
}

export class UCBoolTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedBool;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Bool;
	}

	static getStaticName(): Name {
		return NAME_BOOL;
	}
}

export class UCPointerTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedPointer;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
	}

	static getStaticName(): Name {
		return NAME_POINTER;
	}
}

export class UCButtonTypeSymbol extends UCPredefinedTypeSymbol implements ITypeSymbol {
	getReference(): ISymbol {
		return PredefinedButton;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Byte;
	}

	static getStaticName(): Name {
		return NAME_BUTTON;
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
		if (this.reference !== NativeClass && this.reference instanceof UCClassSymbol) {
			return UCTypeKind.Object;
		}
		return this.reference instanceof UCFieldSymbol && this.reference.getTypeKind() || UCTypeKind.Error;
	}

	getValidTypeKind(): UCTypeKind | undefined {
		return this.validTypeKind;
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
			case UCTypeKind.Package: {
				symbol = PackagesTable.findSymbol(id, false);
				break;
			}

			case UCTypeKind.Class: case UCTypeKind.Interface: {
				symbol = ClassesTable.findSymbol(id, true);
				break;
			}

			case UCTypeKind.Enum: case UCTypeKind.Struct: {
				symbol = ObjectsTable.findSymbol(id);
				break;
			}

			case UCTypeKind.State: case UCTypeKind.Delegate: {
				symbol = context.findSuperSymbol(id);
				break;
			}

			case UCTypeKind.Type: {
				symbol = ClassesTable.findSymbol(id, true) || ObjectsTable.findSymbol(id);
				break;
			}

			// Special case for object literals like Property'Engine.Member.Member...'
			// FIXME: How to handle ambiguous literals such as class'Engine' versus class'Engine.Interactions',
			// -- where Engine either be the class or package named "Engine".
			case UCTypeKind.Object: {
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
		return PredefinedArray.getTooltip();
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Array;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitArrayType(this);
	}
}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {
	reference = PredefinedDelegate;

	getTooltip(): string {
		return PredefinedDelegate.getTooltip();
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Delegate;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDelegateType(this);
	}
}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {
	reference = PredefinedMap;

	getTooltip(): string {
		return PredefinedMap.getTooltip();
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Error;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitMapType(this);
	}
}