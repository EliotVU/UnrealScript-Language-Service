import { Position, Range } from 'vscode-languageserver';

import { SymbolErrorDiagnostic, ErrorDiagnostic, UnrecognizedFieldDiagnostic, UnrecognizedTypeDiagnostic } from './diagnostics/diagnostic';
import { getEnumMember, config } from './indexer';
import { intersectsWith } from './helpers';
import { UCDocument } from './document';
import { Name } from './names';

import {
	ISymbol, UCSymbol,
	UCObjectTypeSymbol, UCStructSymbol,
	UCPropertySymbol, UCSymbolReference,
	UCMethodSymbol, UCClassSymbol, UCEnumSymbol,
	NativeClass, NativeEnum,
	VectorTypeRef, VectMethodLike,
	RotatorTypeRef, RotMethodLike,
	RangeTypeRef, RngMethodLike,
	ITypeSymbol,
	UCDelegateSymbol, UCStateSymbol,
	analyzeTypeSymbol, ClassesTable, ObjectsTable,
	findSuperStruct, UCTypeFlags,
	IContextInfo, UCFieldSymbol,
	LengthProperty, UCBaseOperatorSymbol, UCBinaryOperatorSymbol,
	typeMatchesFlags, TypeSymbolCastMap, Identifier,
	UCArrayTypeSymbol, getTypeFlagsName
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IExpression {
	getRange(): Range;

	getMemberSymbol(): ISymbol | undefined;
	getType(): ITypeSymbol | undefined;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;
	analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;

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

	abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	index(_document: UCDocument, _context?: UCStructSymbol, _info?: IContextInfo): void {}
	analyze(_document: UCDocument, _context?: UCStructSymbol, _info?: IContextInfo): void {}

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

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression?.analyze(document, context, info);
	}
}

export class UCArrayCountExpression extends UCParenthesizedExpression {

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
			const symbol = type.getReference();
			if (symbol instanceof UCMethodSymbol) {
				// TODO: Coerce return type
				return symbol.getType();
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

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression.index(document, context, Object.assign(info || {}, { hasArguments: true }));

		const type = this.expression.getType();
		const symbol = type?.getReference();
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
			if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				arg.index(document, context, info);
			}
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		this.expression.analyze(document, context, Object.assign(info || {}, { hasArguments: true }));

		const type = this.expression.getType();
		const symbol = type?.getReference();
		if (symbol instanceof UCMethodSymbol) {
			let i = 0;
			let passedArgumentsCount = 0; // excluding optional parameters.
			if (this.arguments) for (; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				arg.analyze(document, context, info);

				const param = symbol.params && symbol.params[i];
				if (!param) {
					document.nodes.push(new ErrorDiagnostic(
						arg.getRange(),
						`Unexpected argument!`)
					);
					++ passedArgumentsCount;
					continue;
				}

				if (!param.isOptional()) {
					++ passedArgumentsCount;
					if (arg instanceof UCEmptyArgument) {
						document.nodes.push(new ErrorDiagnostic(
							arg.getRange(),
							`An argument for non-optional '${param.getId()}' is missing.`
						));
						continue;
					}
				}

				if (arg instanceof UCEmptyArgument) {
					continue;
				}

				const type = arg.getType();
				if (!type) {
					// We already have generated an error diagnostic when type is an error.
					// Thus we can skip further skips that would only overload the programmer.
					continue;
				}

				if (param.isOut()) {
					const argSymbol = arg.getType()?.getReference();
					if (!argSymbol) {
						document.nodes.push(new ErrorDiagnostic(
							arg.getRange(),
							`Non-resolved argument cannot be passed to an 'out' parameter.`)
						);
					} else if (argSymbol instanceof UCFieldSymbol) {
						if (argSymbol === LengthProperty) {
							document.nodes.push(new ErrorDiagnostic(
								arg.getRange(),
								`Cannot pass array property 'Length' to an 'out' parameter.`)
							);
						}
						else if (argSymbol.isConst()) {
							document.nodes.push(new ErrorDiagnostic(
								arg.getRange(),
								`Argument '${argSymbol.getId()}' cannot be passed to an 'out' parameter, because it is a constant.`)
							);
						}
					}
				}

				if (config.checkTypes) {
					const expectedFlags = param.getType()?.getTypeFlags() || UCTypeFlags.Error;
					if (type && !typeMatchesFlags(type, expectedFlags)) {
						document.nodes.push(new ErrorDiagnostic(
							arg.getRange(),
							`Argument of type '${getTypeFlagsName(type)}' is not assignable to parameter of type '${UCTypeFlags[expectedFlags]}'.`)
						);
					}
				}
			}

			// When we have more params than required, we'll catch an unexpected argument error, see above.
			if (symbol.requiredParamsCount && passedArgumentsCount < symbol.requiredParamsCount) {
				const totalPassedParamsCount = i;
				document.nodes.push(new ErrorDiagnostic(
					this.getRange(),
					`Expected ${symbol.requiredParamsCount} arguments, but got ${totalPassedParamsCount}.`
				));
			}
		}  else {
			// TODO: Validate if expressed symbol is callable,
			// i.e. either a 'Function/Delegate', 'Class', or a 'Struct' like Vector/Rotator.
			if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				arg.analyze(document, context, info);
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
		} else if (this.getMemberSymbol() instanceof UCPropertySymbol && (this.getMemberSymbol() as UCPropertySymbol)?.isFixedArray()) {
			// metaclass is resolved in @UCMemberExpression's .getType
			return type;
		}
		return undefined;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.argument) {
			const symbol = this.argument.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.expression) this.expression.index(document, context, info);
		if (this.argument) this.argument.index(document, context, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		const type = this.getType();
		if (!type) {
			document.nodes.push(new ErrorDiagnostic(this.getRange(),
				`Type of '${this.getMemberSymbol()?.getQualifiedName()}' is not a valid array.`
			));
		} else if (!this.expression) {
			document.nodes.push(new ErrorDiagnostic(this.getRange(),
				`An element access expression should take an argument.`
			));
		}

		this.expression?.analyze(document, context, info);
		if (this.argument) {
			this.argument.analyze(document, context, info);
		} else {
			document.nodes.push(new ErrorDiagnostic(this.getRange(),
				`Missing expression in [].`
			));
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
		const symbol = this.left.getSymbolAtPos(position) || this.member.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		// DO NOT PASS @info, only our right expression needs access to @info.
		this.left.index(document, context);

		const memberContext = this.left.getType()?.getReference();
		this.member.index(document, memberContext as UCStructSymbol, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		// DO NOT PASS @info, only our right expression needs access to @info.
		this.left.analyze(document, context);

		const memberContext = this.left.getType()?.getReference();
		this.member.analyze(document, memberContext as UCStructSymbol, info);
	}
}

export class UCConditionalExpression extends UCExpression {
	public condition: IExpression;
	public true?: IExpression;
	public false?: IExpression;

	getMemberSymbol() {
		return (this.true && this.true.getMemberSymbol()) || (this.false && this.false.getMemberSymbol());
	}

	getType() {
		return this.true && this.true.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.condition) {
			const symbol = this.condition.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.true) {
			const symbol = this.true.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.false) {
			const symbol = this.false.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.condition) this.condition.index(document, context, info);
		if (this.true) this.true.index(document, context, info);
		if (this.false) this.false.index(document, context, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.condition) this.condition.analyze(document, context, info);
		if (this.true) this.true.analyze(document, context, info);
		if (this.false) this.false.analyze(document, context, info);
	}
}

// TODO: What about UCState? Can states properly declare operators?
function findOperatorSymbol(id: Name, context: UCStructSymbol): UCSymbol | undefined {
	let scope = context instanceof UCMethodSymbol ? context.outer : context;
	if (scope instanceof UCStateSymbol) {
		scope = scope.outer;
	}
	for (; scope instanceof UCStructSymbol; scope = scope.super) {
		for (var child = scope.children; child; child = child.next) {
			if (child.getId() === id) {
				if (child instanceof UCMethodSymbol && child.isOperator()) {
					return child;
				}
			}
		}
	}
}

function findPreOperatorSymbol(id: Name, context: UCStructSymbol): UCSymbol | undefined {
	let scope = context instanceof UCMethodSymbol ? context.outer : context;
	if (scope instanceof UCStateSymbol) {
		scope = scope.outer;
	}
	for (; scope instanceof UCStructSymbol; scope = scope.super) {
		for (var child = scope.children; child; child = child.next) {
			if (child.getId() === id) {
				if (child instanceof UCMethodSymbol && child.isPreOperator()) {
					return child;
				}
			}
		}
	}
}

function findPostOperatorSymbol(id: Name, context: UCStructSymbol): UCSymbol | undefined {
	let scope = context instanceof UCMethodSymbol ? context.outer : context;
	if (scope instanceof UCStateSymbol) {
		scope = scope.outer;
	}
	for (; scope instanceof UCStructSymbol; scope = scope.super) {
		for (var child = scope.children; child; child = child.next) {
			if (child.getId() === id) {
				if (child instanceof UCMethodSymbol && child.isPostOperator()) {
					return child;
				}
			}
		}
	}
}

abstract class UCBaseOperatorExpression extends UCExpression {
	public expression: IExpression;
	public operator: UCSymbolReference;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getType() {
		const ref = this.operator.getReference();
		return ref instanceof UCBaseOperatorSymbol ? ref.getType() : undefined;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator && this.operator.getSymbolAtPos(position);
		if (symbol && this.operator!.getReference()) {
			return symbol;
		}
		return this.expression && this.expression.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?) {
		if (this.expression) this.expression.index(document, context, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.expression) this.expression.analyze(document, context, info);
	}
}

export class UCPostOperatorExpression extends UCBaseOperatorExpression {
	index(document: UCDocument, context: UCStructSymbol, info?) {
		super.index(document, context, info);
		if (this.operator) {
			const operatorSymbol = findPostOperatorSymbol(this.operator.getId(), context);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context, info);
		if (this.operator) {
			const operatorSymbol = this.operator.getReference();
			if (!operatorSymbol) {
				document.nodes.push(new SymbolErrorDiagnostic(this.operator, `Invalid postoperator '${this.operator.getId()}'.`));
			}
		}
	}
}

export class UCPreOperatorExpression extends UCBaseOperatorExpression {
	index(document: UCDocument, context: UCStructSymbol, info?) {
		super.index(document, context);
		if (this.operator) {
			const operatorSymbol = findPreOperatorSymbol(this.operator.getId(), context);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context, info);
		if (this.operator) {
			const operatorSymbol = this.operator.getReference();
			if (!operatorSymbol) {
				document.nodes.push(new SymbolErrorDiagnostic(this.operator, `Invalid preoperator '${this.operator.getId()}'.`));
			}
		}
	}
}

// TODO: Index and match overloaded operators.
export class UCBinaryOperatorExpression extends UCExpression {
	public left?: IExpression;
	public operator?: UCSymbolReference;
	public right?: IExpression;

	getMemberSymbol() {
		// TODO: Return the operator's return type.
		return (this.left && this.left.getMemberSymbol()) || (this.right && this.right.getMemberSymbol());
	}

	getType() {
		const ref = this.operator!.getReference();
		return ref instanceof UCBinaryOperatorSymbol ? ref.getType() : undefined;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator && this.operator.getSymbolAtPos(position);
		if (symbol && this.operator!.getReference()) {
			return symbol;
		}

		if (this.left) {
			const symbol = this.left.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.right) {
			const symbol = this.right.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol, info: IContextInfo = {}) {
		if (this.left) {
			this.left.index(document, context, info);

			const type = this.left.getType();
			info.typeFlags = type && type.getTypeFlags();
		}
		if (this.right) {
			this.right.index(document, context, info);
		}

		if (this.operator) {
			// const leftType = this.left.getType();
			// const rightType = this.right && this.right.getType();

			const opName = this.operator.getId();
			// const opName = toName(this.operator.getId().toString() + (leftType && leftType.getId()) + (rightType && rightType.getId()));
			const operatorSymbol = findOperatorSymbol(opName, context);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
	}
}

export class UCAssignmentExpression extends UCBinaryOperatorExpression {
	getType() {
		return undefined;
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context, info);

		if (!this.left) {
			document.nodes.push(new SymbolErrorDiagnostic(this, "Missing left expression!"));
			return;
		}


		if (!this.right) {
			document.nodes.push(new SymbolErrorDiagnostic(this, "Missing right expression!"));
			return;
		}

		// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
		const letType = this.left.getType();
		const letSymbol = letType?.getReference();
		if (letSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// Properties with a defined array dimension cannot be assigned!
				if (letSymbol.isFixedArray()) {
					document.nodes.push(new ErrorDiagnostic(letType!.getRange(),
						`Cannot assign to '${letSymbol.getId()}' because it is a fixed array.`
					));
				}

				if (letSymbol.isConst()) {
					document.nodes.push(new ErrorDiagnostic(letType!.getRange(),
						`Cannot assign to '${letSymbol.getId()}' because it is a constant.`
					));
				}
			} else if (letSymbol instanceof UCMethodSymbol && !(letSymbol instanceof UCDelegateSymbol)) {
				document.nodes.push(new ErrorDiagnostic(letType!.getRange(),
					`Cannot assign to '${letSymbol.getId()}' because it is a function. Did you mean to assign a delegate?`
				));
				// TODO: Distinguish a delegate from a regular method!
				// TODO: throw error unless it's a delegate.
			}
		}
	}
}

export class UCAssignmentOperatorExpression extends UCAssignmentExpression {

}

export class UCDefaultAssignmentExpression extends UCBinaryOperatorExpression {
	getType() {
		return undefined;
	}

	// TODO: @index() Fetch left type, so that we can use the correct lookup strategy.

	analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		if (!this.left) {
			document.nodes.push(new SymbolErrorDiagnostic(this, "Missing left expression!"));
			return;
		}

		if (config.checkTypes) {
			const letType = this.left.getType();
			const letSymbol = letType?.getReference();
			if (letType && !letSymbol) {
				const errorNode = new ErrorDiagnostic(
					this.left.getRange(),
					`Type of '${letType.getId()}' cannot be assigned a default value!`
				);
				document.nodes.push(errorNode);
			}

			if (this.right) {
				const leftType = this.left.getType();
				const rightType = this.right.getType();
				if (rightType) {
					const rightFlags = rightType.getTypeFlags();
					if (leftType && !typeMatchesFlags(leftType, rightFlags)) {
						document.nodes.push(new ErrorDiagnostic(
							this.left.getRange(),
							`Cannot assign variable of type '${getTypeFlagsName(leftType)}' to type '${getTypeFlagsName(rightType)}'`
						));
					}
				} else {
					// TODO: Invalid type?
				}

			} else {
				// TODO: Missing value
			}
		}

		// TODO: pass valid type information
		super.analyze(document, context, info);
	}
}

export class UCMemberExpression extends UCExpression {
	protected typeRef?: ITypeSymbol;

	constructor(protected id: Identifier) {
		super(id.range);
	}

	getId(): Name {
		return this.id.name;
	}

	getMemberSymbol() {
		return this.typeRef && this.typeRef.getReference();
	}

	getType() {
		const symbol = this.typeRef?.getReference();
		// We resolve UCMethodSymbols in UCCallExpression, because we don't want to return the function's type in assignment expressions...
		if (symbol instanceof UCPropertySymbol) {
			return symbol.getType();
		}
		return this.typeRef;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		if (this.typeRef) {
			return this.typeRef.getReference() && this.typeRef;
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		const id = this.id.name;
		if (info && info.hasArguments) {
			// Casting to a int, byte, bool? etc...
			const typeClass = TypeSymbolCastMap.get(id);
			const ref = typeClass && new typeClass(this.id);
			if (ref) {
				this.typeRef = ref;
			} else {
				// Casting to a Class, Struct, or Enum?
				const structSymbol = ClassesTable.findSymbol(id, true) || ObjectsTable.findSymbol(id);
				if (structSymbol) {
					const type = new UCObjectTypeSymbol(this.id);
					type.setReference(structSymbol, document);
					this.typeRef = type;
					return;
				}
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

	analyze(document: UCDocument, context?: UCSymbol, _info?: IContextInfo) {
		if (!this.typeRef && context) {
			document.nodes.push(new UnrecognizedFieldDiagnostic(this.id, context));
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
	public structRef?: UCObjectTypeSymbol;

	// Resolved structRef.
	private superStruct?: UCStructSymbol;

	getMemberSymbol() {
		return this.superStruct;
	}

	getType() {
		return this.structRef;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.structRef && this.structRef.getSymbolAtPos(position)) {
			return this.structRef;
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		context = (context instanceof UCMethodSymbol && context.outer instanceof UCStateSymbol && context.outer.super)
			? context.outer
			: document.class!;

		if (this.structRef) {
			// FIXME: UE2 doesn't verify inheritance, thus particular exploits are possible by calling a super function through an unrelated class,
			// -- this let's programmers write data in different parts of the memory.
			// -- Thus should we just be naive and match any type instead?
			const symbol = findSuperStruct(context, this.structRef.getId()) || ClassesTable.findSymbol(this.structRef.getId(), true);
			if (symbol instanceof UCStructSymbol) {
				this.structRef.setReference(symbol, document);
				this.superStruct = symbol;
			}
		} else {
			this.superStruct = context.super;
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, _context?: UCStructSymbol) {
		if (this.structRef) {
			analyzeTypeSymbol(document, this.structRef);
		}
	}
}

export class UCNewExpression extends UCCallExpression {
	// TODO: Implement pseudo new operator for hover info?
	getType() {
		return undefined;
	}
}

export abstract class UCLiteral extends UCExpression {
	getValue(): number | undefined {
		return undefined;
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getType(): ITypeSymbol | undefined {
		return undefined;
	}

	getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
		return undefined;
	}

	index(_document: UCDocument, _context?: UCStructSymbol): void { }
	analyze(_document: UCDocument, _context?: UCStructSymbol): void { }
}

export class UCNoneLiteral extends UCLiteral {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.None;
	}
}

export class UCStringLiteral extends UCLiteral {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.String;
	}
}

export class UCNameLiteral extends UCLiteral {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Name;
	}
}

export class UCBoolLiteral extends UCLiteral {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Bool;
	}
}

export class UCFloatLiteral extends UCLiteral {
	value: number;

	getValue(): number {
		return this.value;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Float;
	}
}

export class UCIntLiteral extends UCLiteral {
	value: number;

	getValue(): number {
		return this.value;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}
}

export class UCByteLiteral extends UCLiteral {
	value: number;

	getValue(): number {
		return this.value;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Byte;
	}
}

export class UCObjectLiteral extends UCExpression {
	public castRef: UCSymbolReference;
	public objectRef?: ITypeSymbol;

	getMemberSymbol() {
		return this.objectRef && this.objectRef.getReference() || this.castRef.getReference() || NativeClass;
	}

	getType() {
		return this.objectRef;
	}

	getContainedSymbolAtPos(position: Position) {
		if (intersectsWith(this.castRef.getRange(), position)) {
			return this.castRef.getReference() && this.castRef;
		}

		if (this.objectRef && intersectsWith(this.objectRef.getRange(), position)) {
			return this.objectRef.getReference() && this.objectRef;
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		const castSymbol = ClassesTable.findSymbol(this.castRef.getId(), true);
		if (castSymbol) {
			this.castRef.setReference(castSymbol, document);
		}

		this.objectRef && this.objectRef.index(document, context);
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, _context?: UCStructSymbol) {
		const castSymbol = this.castRef.getReference();
		const objectSymbol = this.objectRef && this.objectRef.getReference();
		if (this.objectRef) {
			if (!objectSymbol) {
				document.nodes.push(new UnrecognizedFieldDiagnostic(this.objectRef.id));
			}
			else if (castSymbol === NativeClass && !(objectSymbol instanceof UCClassSymbol)) {
				document.nodes.push(new SymbolErrorDiagnostic(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not a class!`));
			}
			else if (castSymbol === NativeEnum && !(objectSymbol instanceof UCEnumSymbol)) {
				document.nodes.push(new SymbolErrorDiagnostic(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not an enum!`));
			}
		}

		if (!castSymbol) {
			document.nodes.push(new UnrecognizedTypeDiagnostic(this.castRef));
		}
	}
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
	structType: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.structType.getReference();
	}

	getType() {
		return this.structType;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getReference() && this.structType as ISymbol;
	}

	index(document: UCDocument, _context?: UCStructSymbol) {
		const symbol = ObjectsTable.findSymbol(this.structType.getId());
		if (symbol) {
			this.structType.setReference(symbol, document, undefined, this.getRange());
		}
	}
}

export class UCDefaultStructLiteral extends UCExpression {
	public arguments?: Array<IExpression | undefined>;

	getContainedSymbolAtPos(position: Position) {
		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg && arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.arguments) for (let arg of this.arguments) {
			arg && arg.index(document, context);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.arguments) for (let arg of this.arguments) {
			arg && arg.analyze(document, context);
		}
	}
}

export class UCVectLiteral extends UCStructLiteral {
	structType = VectorTypeRef;

	getContainedSymbolAtPos(_position: Position) {
		return VectMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRotLiteral extends UCStructLiteral {
	structType = RotatorTypeRef;

	getContainedSymbolAtPos(_position: Position) {
		return RotMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRngLiteral extends UCStructLiteral {
	structType = RangeTypeRef;

	getContainedSymbolAtPos(_position: Position) {
		return RngMethodLike as unknown as UCSymbolReference;
	}
}

// See also @UCArrayCountExpression, this literal is restricted to const value tokens.
export class UCArrayCountLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getValue() {
		const symbol = this.argumentRef && this.argumentRef.getReference();
		return symbol instanceof UCPropertySymbol && symbol.getArrayDimSize() || undefined;
	}

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef && this.argumentRef.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.argumentRef && this.argumentRef.index(document, context!);
	}

	// TODO: Validate that referred property is a valid static array!
	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);

		if (this.argumentRef) {
			analyzeTypeSymbol(document, this.argumentRef);
		}
	}
}

export class UCNameOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef && this.argumentRef.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.argumentRef && this.argumentRef.index(document, context!);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);
		if (this.argumentRef) {
			analyzeTypeSymbol(document, this.argumentRef);
		}
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

	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);
		if (this.argumentRef) {
			analyzeTypeSymbol(document, this.argumentRef);
		}
	}
}

export class UCMetaClassExpression extends UCParenthesizedExpression {
	public classRef?: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.classRef?.getReference();
	}

	getType() {
		return this.classRef;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef?.getSymbolAtPos(position) as UCObjectTypeSymbol;
		return subSymbol && subSymbol.getReference() && this.classRef || super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		super.index(document, context, info);
		this.classRef?.index(document, context!);
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context, info);
		if (this.classRef) {
			analyzeTypeSymbol(document, this.classRef);
		}
	}
}