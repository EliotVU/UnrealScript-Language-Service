import { Position, Range } from 'vscode-languageserver';

import { getEnumMember, config } from './indexer';
import { intersectsWith } from './helpers';
import { UCDocument } from './document';

import {
	ISymbol, UCSymbol, UCMethodSymbol,
	UCObjectTypeSymbol, UCStructSymbol,
	UCPropertySymbol, UCSymbolReference,
	StaticVectorType, VectMethodLike,
	StaticRotatorType, RotMethodLike,
	StaticRangeType, RngMethodLike,
	ITypeSymbol, UCStateSymbol, ObjectsTable,
	findSuperStruct, UCTypeFlags,
	IContextInfo, Identifier,
	UCBaseOperatorSymbol, UCBinaryOperatorSymbol,
	UCArrayTypeSymbol, tryFindClassSymbol, UCConstSymbol,
	StaticByteType, StaticFloatType, StaticIntType, StaticNoneType,
	StaticStringType, StaticNameType, StaticBoolType,
	CastTypeSymbolMap, resolveType, UCQualifiedTypeSymbol,
	getSymbolOuterHash, getSymbolHash, OuterObjectsTable,
	UCPackage, CORE_PACKAGE, findOrIndexClassSymbol,
	UCObjectSymbol,
	DefaultArray,
	typeMatchesFlags,
	findSymbol
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IExpression {
	getRange(): Range;
	getMemberSymbol(): ISymbol | undefined;
	getType(): ITypeSymbol | undefined;
	getSymbolAtPos(position: Position): ISymbol | undefined;
	getValue(): number | undefined;

	// TODO: Consider using visitor pattern to indexize.
	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;
	accept<Result>(visitor: SymbolWalker<Result>): Result;
}

export abstract class UCExpression implements IExpression {
	constructor(protected range: Range) {
	}

	getRange(): Range {
		return this.range;
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getType(): ITypeSymbol | undefined {
		return undefined;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getValue(): number | undefined {
		return undefined;
	}

	abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	index(_document: UCDocument, _context?: UCStructSymbol, _info?: IContextInfo): void { }

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitExpression(this);
	}
}

export class UCParenthesizedExpression extends UCExpression {
	public expression?: IExpression;

	getMemberSymbol() {
		return this.expression?.getMemberSymbol();
	}

	getType() {
		return this.expression?.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.expression?.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression?.index(document, context, info);
	}
}

export class UCArrayCountExpression extends UCExpression {
	public argument?: IExpression;

	getMemberSymbol() {
		return this.argument?.getMemberSymbol();
	}

	getType() {
		return this.argument?.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.argument?.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.argument?.index(document, context, info);
	}
}

export class UCEmptyArgument extends UCExpression {
	getContainedSymbolAtPos(_position: Position) {
		return undefined;
	}
}

export class UCCallExpression extends UCExpression {
	public expression: IExpression;
	public arguments?: Array<IExpression>;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getType() {
		const type = this.expression.getType();
		if (type) {
			const symbol = type.getRef();
			if (symbol instanceof UCMethodSymbol) {
				const returnValue = symbol.returnValue;
				if (returnValue) {
					if (returnValue.isCoerced() && this.arguments) {
						const firstArgumentType = this.arguments[0]?.getType();
						return resolveType(firstArgumentType);
					}
					return resolveType(returnValue.getType());
				}
				return undefined;
			}
		}
		return type;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.expression.getSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		// Note: Intentionally passing a clean info object.
		this.expression.index(document, context, { hasArguments: true });

		const type = this.expression.getType();
		const symbol = type?.getRef();
		if (symbol instanceof UCMethodSymbol) {
			if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				const param = symbol.params?.[i];
				const expectedFlags = param?.getType()?.getTypeFlags() || UCTypeFlags.Error;
				arg.index(document, context, {
					typeFlags: expectedFlags,
					inAssignment: param ? param.isOut() : undefined
				});
			}
		} else {
			// TODO: Handle call on array??
			if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				arg.index(document, context, info);
			}
		}
	}
}

export class UCElementAccessExpression extends UCExpression {
	public expression: IExpression;
	public argument?: IExpression;

	getMemberSymbol() {
		return this.expression?.getMemberSymbol();
	}

	// Returns the type we are working with after [] has taken affect, this means we return undefined if the type is invalid.
	getType() {
		const type = this.expression?.getType();
		if (type instanceof UCArrayTypeSymbol) {
			// Resolve metaclass class<Actor> to Actor
			if (type.baseType instanceof UCObjectTypeSymbol && type.baseType.baseType) {
				return type.baseType.baseType;
			}
			return type.baseType;
		} else {
			const symbol = this.getMemberSymbol();
			if (symbol instanceof UCPropertySymbol && symbol.isFixedArray()) {
				// metaclass is resolved in @UCMemberExpression's .getType
				return type;
			}
		}
		return undefined;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.expression?.getSymbolAtPos(position) ?? this.argument?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression?.index(document, context, info);
		this.argument?.index(document, context, info);
	}
}

export class UCDefaultElementAccessExpression extends UCElementAccessExpression {
	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression?.index(document, context, info);
		// this.argument?.index(document, context, info);

		if (this.argument && this.argument instanceof UCIdentifierLiteralExpression)  {
			const id = this.argument.id;
			const symbol = (context instanceof UCStructSymbol && context.findSuperSymbol(id.name)) ?? getEnumMember(id.name);
			if (symbol) {
				const type = new UCObjectTypeSymbol(id);
				type.setReference(symbol, document);
				this.argument.typeRef = type;
			}
		}
	}
}

export class UCPropertyAccessExpression extends UCExpression {
	public left: IExpression;
	public member: UCMemberExpression;

	getMemberSymbol() {
		return this.member.getMemberSymbol();
	}

	getType() {
		return this.member.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		return this.left.getSymbolAtPos(position) ?? this.member.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		// DO NOT PASS @info, only our right expression needs access to @info.
		this.left.index(document, context);

		const memberContext = this.left.getType()?.getRef();
		this.member.index(document, memberContext as UCStructSymbol, info);
	}
}

export class UCConditionalExpression extends UCExpression {
	public condition: IExpression;
	public true?: IExpression;
	public false?: IExpression;

	getMemberSymbol() {
		return this.true?.getMemberSymbol();
	}

	getType() {
		return this.true?.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		return this.condition.getSymbolAtPos(position) ?? this.true?.getSymbolAtPos(position) ?? this.false?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.condition?.index(document, context, info);
		this.true?.index(document, context, info);
		this.false?.index(document, context, info);
	}
}

export abstract class UCBaseOperatorExpression extends UCExpression {
	public expression: IExpression;
	public operator: UCSymbolReference;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getType() {
		const operatorSymbol = this.operator.getRef();
		if (operatorSymbol instanceof UCBaseOperatorSymbol) {
			return operatorSymbol.getType();
		}
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator.getSymbolAtPos(position);
		if (symbol && this.operator.getRef()) {
			return symbol;
		}
		return this.expression?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?) {
		this.expression?.index(document, context, info);
	}
}

export class UCPostOperatorExpression extends UCBaseOperatorExpression {
	index(document: UCDocument, context: UCStructSymbol, info?) {
		super.index(document, context, info);
		if (this.operator) {
			const type = this.expression.getType();
			if (type) {
				const opId = this.operator.getName();
				const operatorSymbol = findSymbol(context, opId, (
					symbol => symbol instanceof UCBaseOperatorSymbol
					&& symbol.isPostOperator()
					&& symbol.params !== undefined
					&& symbol.params.length === 1
					&& typeMatchesFlags(symbol.params[0].getType(), type, symbol.params[0].isCoerced())
				));
				if (operatorSymbol) {
					this.operator.setReference(operatorSymbol, document);
				}
			}
		}
	}
}

export class UCPreOperatorExpression extends UCBaseOperatorExpression {
	index(document: UCDocument, context: UCStructSymbol, info?) {
		super.index(document, context, info);
		if (this.operator) {
			const type = this.expression.getType();
			if (type) {
				const opId = this.operator.getName();
				const operatorSymbol = findSymbol(context, opId, (
					symbol => symbol instanceof UCBaseOperatorSymbol
					&& symbol.isPreOperator()
					&& symbol.params !== undefined
					&& symbol.params.length === 1
					&& typeMatchesFlags(symbol.params[0].getType(), type, symbol.params[0].isCoerced())
				));
				if (operatorSymbol) {
					this.operator.setReference(operatorSymbol, document);
				}
			}
		}
	}
}

export class UCBinaryOperatorExpression extends UCExpression {
	public left?: IExpression;
	public operator?: UCSymbolReference;
	public right?: IExpression;

	getMemberSymbol() {
		return this.operator?.getRef();
	}

	getType() {
		const operatorSymbol = this.operator?.getRef();
		if (operatorSymbol instanceof UCBinaryOperatorSymbol) {
			return operatorSymbol.getType();
		}
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator?.getSymbolAtPos(position);
		if (symbol && this.operator!.getRef()) {
			return symbol;
		}
		return this.left?.getSymbolAtPos(position) ?? this.right?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info: IContextInfo = {}) {
		if (this.left) {
			this.left.index(document, context, info);

			const type = this.left.getType();
			info.typeFlags = type?.getTypeFlags();
		}
		this.right?.index(document, context, info);

		if (this.operator) {
			const leftType = this.left?.getType();
			const rightType = this.right?.getType();
			if (leftType && rightType) {
				const opId = this.operator.getName();
				const operatorSymbol = findSymbol(context, opId, (
					symbol => symbol instanceof UCBaseOperatorSymbol
					&& symbol.isOperator()
					&& symbol.params !== undefined
					&& symbol.params.length === 2
					&& typeMatchesFlags(symbol.params[0].getType(), leftType, symbol.params[0].isCoerced())
					&& typeMatchesFlags(symbol.params[1].getType(), rightType, symbol.params[0].isCoerced())
				));
				if (operatorSymbol) {
					this.operator.setReference(operatorSymbol, document);
				}
			}
		}
	}
}

export class UCAssignmentExpression extends UCBinaryOperatorExpression {
	getType() {
		return undefined;
	}
}

export class UCAssignmentOperatorExpression extends UCBinaryOperatorExpression {

}

export class UCDefaultAssignmentExpression extends UCBinaryOperatorExpression {
	getType() {
		return undefined;
	}
}

/**
 * Resembles "propertyMember.methodMember(arguments)"".
 *
 * @method getMemberSymbol will always return the instance of "methodMember".
 * @method getType will always return the type of instance "propertyMember", because our array operations have no return type.
 */
export class UCDefaultMemberCallExpression extends UCExpression {
	public propertyMember: UCMemberExpression;
	public methodMember: UCMemberExpression;
	public arguments?: Array<IExpression>;

	getMemberSymbol() {
		return this.methodMember.getMemberSymbol();
	}

	getType() {
		const type = this.propertyMember.getType();
		if (type instanceof UCArrayTypeSymbol) {
			// Resolve metaclass class<Actor> to Actor
			if (type.baseType instanceof UCObjectTypeSymbol && type.baseType.baseType) {
				return type.baseType.baseType;
			}
			return type.baseType;
		}
		return type;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.propertyMember.getSymbolAtPos(position) ?? this.methodMember.getSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		this.propertyMember.index(document, context, info);

		const type = this.propertyMember.getType();
		if (type) {
			// As far as I know, default operations are only allowed on arrays.
			if (type instanceof UCArrayTypeSymbol) {
				const id = this.methodMember.id;
				const symbol = DefaultArray.findSuperSymbol(id.name);
				if (symbol) {
					const type = new UCObjectTypeSymbol(id);
					type.setReference(symbol, document);
					this.methodMember.typeRef = type;
				}
			} // else, we don't have to index UCMemberExpressions here.
		}

		if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
			const arg = this.arguments[i];
			arg.index(document, context, info);
		}
	}
}

export class UCMemberExpression extends UCExpression {
	public typeRef?: ITypeSymbol;

	constructor(readonly id: Identifier) {
		super(id.range);
	}

	getMemberSymbol() {
		return this.typeRef?.getRef();
	}

	getType() {
		const symbol = this.typeRef?.getRef();
		// We resolve UCMethodSymbols in UCCallExpression, because we don't want to return the function's type in assignment expressions...
		if (symbol instanceof UCPropertySymbol) {
			return symbol.getType();
		} else if (symbol instanceof UCConstSymbol) {
			return symbol.expression?.getType();
		}
		return this.typeRef;
	}

	getContainedSymbolAtPos(_position: Position) {
		// To return static types, but! We are not storing the ranges for primitive casts anyway...
		// if (this.typeRef instanceof UCPredefinedTypeSymbol) {
		// 	return this.typeRef;
		// }
		// Only return if we have a RESOLVED reference.
		return this.typeRef?.getRef() && this.typeRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		const id = this.id.name;
		if (info?.hasArguments) {
			// Casting to a int, byte, bool? etc...
			const primitiveType = CastTypeSymbolMap.get(id);
			if (primitiveType) {
				this.typeRef = primitiveType;
				return;
			}

			// Casting to a Class, Struct, or Enum?
			const structSymbol = tryFindClassSymbol(id) || ObjectsTable.getSymbol(id);
			if (structSymbol) {
				const type = new UCObjectTypeSymbol(this.id);
				type.setReference(structSymbol, document);
				this.typeRef = type;
				return;
			}
		}

		let member = context instanceof UCStructSymbol && context.findSuperSymbol(id);
		if (!member && (!config.checkTypes || (info && !info.hasArguments && (info.typeFlags && info.typeFlags & UCTypeFlags.EnumCoerce) !== 0))) {
			member = getEnumMember(id);
		}

		if (member) {
			const type = new UCObjectTypeSymbol(this.id);
			const symbolRef = type.setReference(member, document);
			if (symbolRef && info) {
				symbolRef.inAssignment = info.inAssignment;
			}
			this.typeRef = type;
		}
	}
}

/**
 * Represents an identifier in a defaultproperties block. e.g. "Class=ClassName", here "ClassName" would be represented by this expression.
 **/
export class UCIdentifierLiteralExpression extends UCMemberExpression {
	index(document: UCDocument, context?: UCObjectSymbol, info?: IContextInfo) {
		if (!context || !info || !info.typeFlags) {
			return;
		} else if ((info.typeFlags & UCTypeFlags.IdentifierTypes) === 0) {
			return;
		}
		// We don't support objects, although this may be true in the check above due the fact that a class is also an Object.
		else if (info.typeFlags === UCTypeFlags.Object) {
			return;
		}

		const id = this.id.name;

		let member: UCSymbol | undefined;
		const expectingEnum = (info.typeFlags & UCTypeFlags.EnumCoerce) !== 0;
		if (expectingEnum) {
			member = getEnumMember(id);
		}

		if (!member) {
			const expectingClass = info.typeFlags === UCTypeFlags.Class;
			if (expectingClass) {
				member = tryFindClassSymbol(id);
			}
		}

		if (!member) {
			const expectingDelegate = info.typeFlags === UCTypeFlags.Delegate;
			if (expectingDelegate) {
				member = context?.findSuperSymbol(id);
			}
		}

		if (member) {
			const type = new UCObjectTypeSymbol(this.id);
			type.setReference(member, document);
			this.typeRef = type;
		}
	}
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCMemberExpression {
	index(document: UCDocument, _context?: UCStructSymbol) {
		const typeRef = new UCObjectTypeSymbol(this.id);
		typeRef.setReference(document.class!, document, true);
		this.typeRef = typeRef;
	}
}

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPropertyClassAccessExpression extends UCPropertyAccessExpression {

}

export class UCSuperExpression extends UCExpression {
	public structTypeRef?: UCObjectTypeSymbol;

	// Resolved structRef.
	private superStruct?: UCStructSymbol;

	getMemberSymbol() {
		return this.superStruct;
	}

	getType() {
		return this.structTypeRef;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.structTypeRef?.getSymbolAtPos(position)) {
			return this.structTypeRef;
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		context = (context instanceof UCMethodSymbol && context.outer instanceof UCStateSymbol && context.outer.super)
			? context.outer
			: document.class!;

		if (this.structTypeRef) {
			// FIXME: UE2 doesn't verify inheritance, thus particular exploits are possible by calling a super function through an unrelated class,
			// -- this let's programmers write data in different parts of the memory.
			// -- Thus should we just be naive and match any type instead?
			const symbol = findSuperStruct(context, this.structTypeRef.getName()) || tryFindClassSymbol(this.structTypeRef.getName());
			if (symbol instanceof UCStructSymbol) {
				this.structTypeRef.setReference(symbol, document);
				this.superStruct = symbol;
			}
		} else {
			this.superStruct = context.super;
			if (this.superStruct) {
				const type = new UCObjectTypeSymbol(this.superStruct.id, undefined, UCTypeFlags.Class | UCTypeFlags.State);
				type.setReference(this.superStruct, document, false);
				this.structTypeRef = type;
			}
		}
	}
}

export class UCNewExpression extends UCCallExpression {
	// TODO: Implement pseudo new operator for hover info?
}

export abstract class UCLiteral extends UCExpression {
	getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
		return undefined;
	}
}

export class UCNoneLiteral extends UCLiteral {
	getType() {
		return StaticNoneType;
	}

	toString() {
		return 'None';
	}
}

export class UCStringLiteral extends UCLiteral {
	getType() {
		return StaticStringType;
	}

	toString() {
		return '""';
	}
}

export class UCNameLiteral extends UCLiteral {
	getType() {
		return StaticNameType;
	}

	toString() {
		return "''";
	}
}

export class UCBoolLiteral extends UCLiteral {
	value: boolean;

	getType() {
		return StaticBoolType;
	}

	toString() {
		return String(this.value);
	}
}

export class UCFloatLiteral extends UCLiteral {
	value: number;

	getType() {
		return StaticFloatType;
	}

	getValue(): number {
		return this.value;
	}
}

export class UCIntLiteral extends UCLiteral {
	value: number;

	getType() {
		return StaticIntType;
	}

	getValue(): number {
		return this.value;
	}
}

export class UCByteLiteral extends UCLiteral {
	value: number;

	getType() {
		return StaticByteType;
	}

	getValue(): number {
		return this.value;
	}
}

export class UCObjectLiteral extends UCExpression {
	public castRef: ITypeSymbol;
	public objectRef?: UCObjectTypeSymbol | UCQualifiedTypeSymbol;

	getMemberSymbol() {
		return this.objectRef?.getRef() || this.castRef.getRef();
	}

	getType() {
		// TODO: Coerce to specified class if castRef is of type 'Class'
		if ((this.castRef.getTypeFlags() & UCTypeFlags.Class) === UCTypeFlags.Class) {
			return this.objectRef || this.castRef;
		}
		return this.castRef;
	}

	getContainedSymbolAtPos(position: Position) {
		if (intersectsWith(this.castRef.getRange(), position)) {
			return this.castRef.getRef() && this.castRef;
		}
		return this.objectRef?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		this.castRef.index(document, context);

		if (this.objectRef) {
			if (this.objectRef instanceof UCQualifiedTypeSymbol) {
				for (let next: UCQualifiedTypeSymbol | undefined = this.objectRef; next; next = next.left) {
					let symbol: ISymbol | undefined;
					if (next.left) {
						const hash = getSymbolOuterHash(getSymbolHash(next), getSymbolHash(next.left));
						symbol = OuterObjectsTable.getSymbol(hash, this.castRef.getTypeFlags());
						// if (!symbol) {
						// 	break;
						// }
					} else {
						const hash = getSymbolHash(next);
						symbol = ObjectsTable.getSymbol<UCPackage>(hash, UCTypeFlags.Package);
					}
					if (symbol) {
						next.type.setReference(symbol, document);
					}
				}
			} else {
				const id = this.objectRef.getName();
				const symbol = ObjectsTable.getSymbol(id, this.castRef.getTypeFlags())
					|| findOrIndexClassSymbol(id)
					// FIXME: Hacky case for literals like Property'TempColor', only enums and structs are added to the objects table.
					|| context.findSuperSymbol(id);
				if (symbol) {
					this.objectRef.setReference(symbol, document);
				}
			}
			this.objectRef.index(document, context);
		}
	}
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
	structType: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.structType.getRef();
	}

	getType() {
		return this.structType;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getRef() && this.structType as ISymbol;
	}

	index(document: UCDocument, _context?: UCStructSymbol) {
		if (this.structType.getRef()) {
			return;
		}

		const symbol = ObjectsTable.getSymbol<UCStructSymbol>(this.structType.getName(), UCTypeFlags.Struct, CORE_PACKAGE);
		if (symbol) {
			this.structType.setReference(symbol, document, true);
		}
	}
}

export class UCDefaultStructLiteral extends UCExpression {
	public arguments?: Array<IExpression | undefined>;

	getContainedSymbolAtPos(position: Position) {
		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg?.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.arguments) for (let arg of this.arguments) {
			arg?.index(document, context);
		}
	}
}

export class UCVectLiteral extends UCStructLiteral {
	structType = StaticVectorType;

	getContainedSymbolAtPos(_position: Position) {
		return VectMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRotLiteral extends UCStructLiteral {
	structType = StaticRotatorType;

	getContainedSymbolAtPos(_position: Position) {
		return RotMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRngLiteral extends UCStructLiteral {
	structType = StaticRangeType;

	getContainedSymbolAtPos(_position: Position) {
		return RngMethodLike as unknown as UCSymbolReference;
	}
}

// See also @UCArrayCountExpression, this literal is restricted to const value tokens.
export class UCArrayCountLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getValue() {
		const symbol = this.argumentRef?.getRef();
		return symbol instanceof UCPropertySymbol && symbol.getArrayDimSize() || undefined;
	}

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef?.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.argumentRef?.index(document, context!);
	}
}

export class UCNameOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef?.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.argumentRef?.index(document, context!);
	}
}

export class UCSizeOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getValue() {
		// FIXME: We don't have the data to calculate a class's size.
		// const symbol = this.argumentRef?.getReference();
		return undefined;
	}

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef?.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.argumentRef?.index(document, context!);
	}
}

export class UCMetaClassExpression extends UCExpression {
	public expression?: IExpression;
	public classRef?: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.classRef?.getRef();
	}

	getType() {
		return this.classRef;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef?.getSymbolAtPos(position) as UCObjectTypeSymbol;
		return this.expression?.getSymbolAtPos(position) || subSymbol?.getRef() && this.classRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression?.index(document, context, info);
		this.classRef?.index(document, context!);
	}
}