import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { ElementAccessExpressionContext } from '../antlr/UCGrammarParser';

import { UnrecognizedFieldNode, UnrecognizedTypeNode, SemanticErrorNode, ExpressionErrorNode, SemanticErrorRangeNode } from './diagnostics/diagnostics';
import { getEnumMember } from './indexer';
import { intersectsWith, rangeFromBounds } from './helpers';
import { UCDocument } from './document';
import { Name } from './names';

import {
	ISymbol, IContextInfo, UCSymbol,
	UCObjectTypeSymbol, UCStructSymbol,
	UCPropertySymbol, UCSymbolReference,
	UCMethodSymbol, UCClassSymbol,
	ClassesTable, UCEnumSymbol,
	NativeArray, NativeClass, NativeEnum,
	VectorTypeRef, VectMethodLike, RotatorTypeRef, RotMethodLike, RangeTypeRef, RngMethodLike,
	ITypeSymbol, TypeCastMap, UCTypeFlags,
	UCBinaryOperatorSymbol, UCPreOperatorSymbol, UCPostOperatorSymbol,
	UCDelegateSymbol, UCFieldSymbol, LengthProperty, UCBaseOperatorSymbol, UCPredefinedTypeSymbol
} from './Symbols';

function typeMatches(type: UCTypeFlags, other: UCTypeFlags): boolean {
	if ((type & UCTypeFlags.Object) !== 0) {
		if (other === UCTypeFlags.None) {
			return true;
		}
		return (other & UCTypeFlags.Object) !== 0;
	} else if (type === UCTypeFlags.Name) {
		if (other === UCTypeFlags.None) {
			return true;
		}
	} else if ((type & UCTypeFlags.NumberCoerce) !== 0) {
		return (other & UCTypeFlags.NumberCoerce) !== 0;
	}
	return type === other;
}

export function analyzeExpressionType(expression: IExpression, expectedType: UCTypeFlags) {
	const type = expression.getTypeFlags();
	if (type !== expectedType) {
		return new SemanticErrorRangeNode(
			expression.getRange()!,
			`Expected a type of '${UCTypeFlags[expectedType]}', but got type '${UCTypeFlags[type]}'.`
		);
	}
}

function isElementAccessable(symbol: ISymbol): boolean {
	if (symbol instanceof UCPropertySymbol) {
		if (symbol.isDynamicArray() || symbol.isFixedArray()) {
			return true;
		}
	} else if (symbol instanceof UCMethodSymbol) {
		const type = symbol.getType();
		if (type && type.getTypeFlags() === UCTypeFlags.Array) {
			return true;
		}
	}
	return false;
}

export interface IExpression {
	context: ParserRuleContext;

	getRange(): Range;

	getMemberSymbol(): ISymbol | undefined;

	// FIXME: Displace this with getType(),
	// but this requires us to refactor the type symbol to represent flags for non-declared symbols.
	getTypeFlags(): UCTypeFlags;
	getType(): ITypeSymbol | undefined;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;
	analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;
}

export abstract class UCExpression implements IExpression {
	context: ParserRuleContext;

	constructor(protected range?: Range) {
	}

	getRange(): Range {
		if (!this.range) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		return this.range;
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
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

	protected abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	abstract index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;
	abstract analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo): void;

	toString(): string {
		return this.context
			? this.context.text
			: '';
	}
}

export class UCParenthesizedExpression extends UCExpression {
	public expression?: IExpression;

	getMemberSymbol() {
		return this.expression && this.expression.getMemberSymbol();
	}

	getTypeFlags(): UCTypeFlags {
		return this.expression && this.expression.getTypeFlags() || UCTypeFlags.Error;
	}

	getType() {
		return this.expression && this.expression.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.expression && this.expression.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.expression) this.expression.index(document, context, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.expression) this.expression.analyze(document, context, info);
	}
}

export class UCArrayCountExpression extends UCParenthesizedExpression {

}

export class UCEmptyArgument extends UCExpression {
	getContainedSymbolAtPos(position: Position) {
		return undefined;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
	}
}

export class UCCallExpression extends UCExpression {
	public expression: IExpression;
	public arguments?: Array<IExpression>;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getTypeFlags(): UCTypeFlags {
		const type = this.getType();
		return type && type.getTypeFlags() || UCTypeFlags.Error;
	}

	getType() {
		const symbol = this.getMemberSymbol();
		return symbol instanceof UCFieldSymbol && symbol.getType()
			|| symbol instanceof UCPredefinedTypeSymbol && symbol as ITypeSymbol
			|| undefined;
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
		this.expression.index(document, context, { hasArguments: true });

		const symbol = this.expression.getMemberSymbol();
		if (symbol instanceof UCMethodSymbol) {
			if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				const param = symbol.params && symbol.params[i];
				const expectedType = param && param.getTypeFlags() || UCTypeFlags.Error;
				arg.index(document, context, {
					type: expectedType,
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
		this.expression.analyze(document, context, { hasArguments: true });

		const symbol = this.expression.getMemberSymbol();
		if (symbol instanceof UCMethodSymbol) {
			let i = 0;
			let passedArgumentsCount = 0; // excluding optional parameters.
			if (this.arguments) for (; i < this.arguments.length; ++i) {
				const arg = this.arguments[i];
				arg.analyze(document, context, info);

				const param = symbol.params && symbol.params[i];
				if (!param) {
					document.nodes.push(new SemanticErrorRangeNode(
						arg.getRange(),
						`Unexpected argument!`)
					);
					++ passedArgumentsCount;
					continue;
				}

				if (!param.isOptional()) {
					++ passedArgumentsCount;
					if (arg instanceof UCEmptyArgument) {
						document.nodes.push(new SemanticErrorRangeNode(
							arg.getRange(),
							`An argument for non-optional '${param.getId()}' is missing.`
						));
						continue;
					}
				}

				if (arg instanceof UCEmptyArgument) {
					continue;
				}

				const type = arg.getTypeFlags();
				if (type === UCTypeFlags.Error) {
					// We already have generated an error diagnostic when type is an error.
					// Thus we can skip further skips that would only overload the programmer.
					continue;
				}

				if (param.isOut()) {
					const argSymbol = arg.getMemberSymbol();
					if (!argSymbol) {
						document.nodes.push(new SemanticErrorRangeNode(
							arg.getRange(),
							`non-resolved argument is not assignable to an 'out' parameter.`)
						);
					} else if (argSymbol instanceof UCFieldSymbol) {
						if (argSymbol === LengthProperty) {
							document.nodes.push(new SemanticErrorRangeNode(
								arg.getRange(),
								`Cannot pass an array's length property to an 'out' parameter.`)
							);
						}
						else if (argSymbol.isConst()) {
							document.nodes.push(new SemanticErrorRangeNode(
								arg.getRange(),
								`Argument is a 'const', and cannot be assigned to an 'out' parameter.`)
							);
						}
					}
				}

				const expectedType = param.getTypeFlags();
				if (!typeMatches(type, expectedType)) {
					document.nodes.push(new SemanticErrorRangeNode(
						arg.getRange(),
						`Argument of type '${UCTypeFlags[type]}' is not assignable to parameter of type '${UCTypeFlags[expectedType]}'.`)
					);
				}
			}

			// When we have more params than required, we'll catch an unexpected argument error, see above.
			if (symbol.requiredParamsCount && symbol.requiredParamsCount > 0
				&& passedArgumentsCount < symbol.requiredParamsCount) {
				const totalPassedParamsCount = i;
				document.nodes.push(new SemanticErrorRangeNode(
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
	context: ElementAccessExpressionContext;

	public expression: IExpression;
	public argument?: IExpression;

	getMemberSymbol() {
		const symbol = this.expression && this.expression.getMemberSymbol();
		if (symbol instanceof UCFieldSymbol) {
			const type = symbol.getType();
			if (type) {
				if (type instanceof UCObjectTypeSymbol && type.baseType) {
					return type.baseType.getReference();
				}
				return type.getReference();
			}
		}
		// Maybe return undefined?
		return symbol;
	}

	getTypeFlags(): UCTypeFlags {
		const type = this.expression && this.expression.getType();
		if (type) {
			const symbolTypeKind = this.expression.getTypeFlags();
			if (symbolTypeKind === UCTypeFlags.Function) {
				return UCTypeFlags.Error;
			}

			const typeKind = type.getTypeFlags();
			if (typeKind === UCTypeFlags.Array && type instanceof UCObjectTypeSymbol) {
				return type.baseType ? type.baseType.getTypeFlags() : UCTypeFlags.Error;
			}
			return typeKind;
		}
		return UCTypeFlags.Error;
	}

	getType() {
		return this.expression && this.expression.getType();
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
		if (this.expression) {
			this.expression.analyze(document, context, info);

			const symbol = this.expression.getMemberSymbol();
			if (!symbol || !isElementAccessable(symbol)) {
				const range = rangeFromBounds(this.context.OPEN_BRACKET()!.symbol, this.context.CLOSE_BRACKET()!.symbol);
				document.nodes.push(new SemanticErrorRangeNode(range, `[] can only be applied to array types.`));
			}
		}

		if (this.argument) {
			this.argument.analyze(document, context, info);
		} else {
			const range = rangeFromBounds(this.context.OPEN_BRACKET()!.symbol, this.context.CLOSE_BRACKET()!.symbol);
			document.nodes.push(new SemanticErrorRangeNode(range, `Missing expression in [].`));
		}
	}
}

export class UCPropertyAccessExpression extends UCExpression {
	public left: IExpression;
	public member: UCMemberExpression;

	getMemberSymbol() {
		return this.member.getMemberSymbol();
	}

	getTypeFlags(): UCTypeFlags {
		return this.member.getTypeFlags() || UCTypeFlags.Error;
	}

	getType() {
		return this.member.getType();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.left.getSymbolAtPos(position) || this.member.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		let isInAssignment: boolean = false;
		if (info && info.inAssignment) {
			isInAssignment = true;
			delete info.inAssignment;
		}
		this.left.index(document, context, info);

		const memberContext = this.getContextMemberSymbol(this.left && this.left.getMemberSymbol());
		if (memberContext instanceof UCStructSymbol) {
			this.member.index(document, memberContext, Object.assign({ inAssignment: isInAssignment }, info));
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		this.left.analyze(document, context, info);

		const memberContext = this.getContextMemberSymbol(this.left && this.left.getMemberSymbol());
		this.member.analyze(document, memberContext as UCStructSymbol, info);
	}

	private getContextMemberSymbol(symbol?: ISymbol): ISymbol | undefined {
		// Resolve properties to its defined type
		// e.g. given property "local array<Vector> Foo;"
		// -- will be resolved to array or Vector (in an index expression, handled elsewhere).
		if (symbol instanceof UCPropertySymbol) {
			if (symbol.type) {
				return ((symbol.type.getReference() !== NativeArray && symbol.type instanceof UCObjectTypeSymbol && symbol.type.baseType)
					? symbol.type.baseType.getReference()
					: symbol.type.getReference());
			}
			return undefined;
		}
		if (symbol instanceof UCMethodSymbol) {
			if (symbol.returnType) {
				return (symbol.returnType instanceof UCObjectTypeSymbol && symbol.returnType.baseType
					? symbol.returnType.baseType.getReference()
					: symbol.returnType.getReference());
			}
			return undefined;
		}
		return symbol;
	}
}

export class UCConditionalExpression extends UCExpression {
	public condition: IExpression;
	public true?: IExpression;
	public false?: IExpression;

	getMemberSymbol() {
		return (this.true && this.true.getMemberSymbol()) || (this.false && this.false.getMemberSymbol());
	}

	getTypeFlags(): UCTypeFlags {
		return this.true && this.true.getTypeFlags() || UCTypeFlags.Error;
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

function findUnaryOperatorSymbol(id: Name, scope: UCStructSymbol) {
	// TODO: What about UCState? Can states properly declare operators?
	const classContext = scope.outer;
	return classContext instanceof UCStructSymbol ? classContext.findSuperSymbol(id) : undefined;
}

function findOperatorSymbol(id: Name, scope: UCStructSymbol): UCSymbol | undefined {
	// TODO: What about UCState? Can states properly declare operators?
	const classContext = scope.outer;
	return classContext instanceof UCStructSymbol ? classContext.findSuperSymbol(id) : undefined;
}

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;
	public operator: UCSymbolReference;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getTypeFlags(): UCTypeFlags {
		const type = this.getType();
		return type ? type.getTypeFlags() : UCTypeFlags.Error;
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

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.operator) {
			// TODO: overloading
			const operatorSymbol = findUnaryOperatorSymbol(this.operator.getId(), context!);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
		if (this.expression) this.expression.index(document, context, info);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.expression) this.expression.analyze(document, context, info);

		if (this.operator) {
			const operatorSymbol = this.operator.getReference();
			if (operatorSymbol && !(operatorSymbol instanceof UCPreOperatorSymbol) && !(operatorSymbol instanceof UCPostOperatorSymbol)) {
				document.nodes.push(new SemanticErrorNode(
					this.operator,
					`'${operatorSymbol.getId()}' must be an unary operator!`
				));
			} else if (!operatorSymbol) {
				document.nodes.push(new UnrecognizedFieldNode(this.operator, document.class));
			}
		}
	}
}

// TODO: Index and match overloaded operators.
export class UCBinaryExpression extends UCExpression {
	public left: IExpression;
	public operator: UCSymbolReference;
	public right?: IExpression;

	getMemberSymbol() {
		return (this.left && this.left.getMemberSymbol()) || (this.right && this.right.getMemberSymbol());
	}

	getTypeFlags(): UCTypeFlags {
		const type = this.getType();
		return type ? type.getTypeFlags() : UCTypeFlags.Error;
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

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		this.left.index(document, context, info);
		if (this.right) {
			const leftTypeFlags = this.left.getTypeFlags();
			this.right.index(document, context, { type: leftTypeFlags });
		}

		if (this.operator) {
			const leftType = this.left.getType();
			const rightType = this.right && this.right.getType();

			const opName = this.operator.getId();
			// const opName = toName(this.operator.getId().toString() + (leftType && leftType.getId()) + (rightType && rightType.getId()));
			const operatorSymbol = findOperatorSymbol(opName, context);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		if (this.operator) {
			const operatorSymbol = this.operator.getReference();
			if (operatorSymbol && !(operatorSymbol instanceof UCBinaryOperatorSymbol)) {
				document.nodes.push(new SemanticErrorNode(
					this.operator,
					`'${operatorSymbol.getId()}' must be a binary operator!`
				));
			} else if (!operatorSymbol) {
				document.nodes.push(new UnrecognizedFieldNode(this.operator, document.class));
			}
		}

		if (this.left) this.left.analyze(document, context, info);
		if (this.right) this.right.analyze(document, context, info);
	}
}

export class UCAssignmentExpression extends UCBinaryExpression {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}

	getType() {
		return undefined;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		this.left.index(document, context, { inAssignment: true });

		if (this.right) {
			const type = this.left.getTypeFlags();
			this.right.index(document, context, { type: type });
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context, info);

		// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
		if (!this.left) {
			document.nodes.push(new ExpressionErrorNode(this, "Missing left expression!"));
			return;
		}

		const letType = this.left.getTypeFlags();
		const letSymbol = this.left.getMemberSymbol();
		if (letSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// Properties with a defined array dimension cannot be assigned!
				if (letSymbol.isFixedArray()) {
					document.nodes.push(new SemanticErrorRangeNode(
						letSymbol.getRange(),
						"Cannot assign to a static array variable."
					));
				}

				if (letSymbol.isConst()) {
					document.nodes.push(new SemanticErrorRangeNode(
						letSymbol.getRange(),
						"Cannot assign to a constant variable."
					));
				}
			} else if (letSymbol instanceof UCMethodSymbol) {
				// TODO: Distinguish a delegate from a regular method!
				// TODO: throw error unless it's a delegate.
			} else {
				// AN ElementAccessExpression does not return the property but its type that's being assigned, in this case such assignments are legal.
				// -- but elsewhere, assigning a type is illegal!
				if (this.left instanceof UCElementAccessExpression) {

				} else {
					document.nodes.push(new ExpressionErrorNode(
						this.left,
						`Cannot assign to expression (type: '${UCTypeFlags[letType]}'), because it is not a variable.`
					));
				}
			}
		} else {
			if ((letType & UCTypeFlags.Object) !== 0) {
				// TODO:
			}
			else {
				document.nodes.push(new ExpressionErrorNode(
					this.left,
					`Cannot assign to expression (type: '${UCTypeFlags[letType]}'), because it is not a variable.`
				));
			}
		}
	}
}

export class UCDefaultAssignmentExpression extends UCBinaryExpression {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Error;
	}

	getType() {
		return undefined;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.left) {
			this.left.index(document, context, { inAssignment: true });
		}

		if (this.right) {
			const type = this.left && this.left.getTypeFlags();
			this.right.index(document, context, { type: type });
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		if (!this.left) {
			document.nodes.push(new ExpressionErrorNode(this, `Invalid syntax`));
			return;
		}

		const letSymbol = this.left.getMemberSymbol();
		if (letSymbol instanceof UCSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// TODO: check right type
			} else if (letSymbol instanceof UCDelegateSymbol) {
				// TODO: check right type
			} else {
				const errorNode = new ExpressionErrorNode(
					this.left,
					`Type of '${letSymbol.getQualifiedName()}' cannot be assigned a default value!`
				);
				document.nodes.push(errorNode);
			}
		}

		const leftType = this.left.getTypeFlags();
		const rightType = this.right ? this.right.getTypeFlags() : UCTypeFlags.Error;
		if (!typeMatches(leftType, rightType)) {
			document.nodes.push(new ExpressionErrorNode(
				this.left,
				`Cannot assign variable of type '${UCTypeFlags[leftType]}' to type '${UCTypeFlags[rightType]}'`
			));
		}

		// TODO: pass valid type information
		super.analyze(document, context, info);
	}
}

export class UCMemberExpression extends UCExpression {
	constructor(protected symbolRef: UCSymbolReference) {
		super(symbolRef.getRange());
	}

	getId(): Name {
		return this.symbolRef.getId();
	}

	getMemberSymbol() {
		return this.symbolRef.getReference();
	}

	getTypeFlags(): UCTypeFlags {
		return this.symbolRef.getTypeFlags();
	}

	getType() {
		const ref = this.getMemberSymbol();
		return ref instanceof UCFieldSymbol ? ref.getType() : undefined;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.symbolRef.getReference() && this.symbolRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?: IContextInfo) {
		if (!context) {
			return;
		}

		const id = this.symbolRef.getId();
		if (info && info.hasArguments) {
			// TODO: Check if argument is a byte/int/enum, if true, lookup the call as an enum type!

			// We must match a predefined type over any class or scope symbol!
			const type: ISymbol | undefined = TypeCastMap.get(id) || ClassesTable.findSymbol(id, true);
			if (type) {
				this.symbolRef.setReference(type, document);
				return;
			}
		}

		let symbol = context.findSuperSymbol(id);
		if (!symbol && info && info.type && (info.type & UCTypeFlags.EnumCoerce) !== 0) {
			symbol = getEnumMember(id);
		}

		if (symbol) {
			this.symbolRef.setReference(
				symbol, document,
				info ? { inAssignment: info.inAssignment } : undefined
			);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol | ISymbol, info?) {
		if (context && !(context instanceof UCStructSymbol)) {
			document.nodes.push(new SemanticErrorNode(this.symbolRef, `'${context.getQualifiedName()}' is an inaccessible type!`));
		} else if (!context || !this.getMemberSymbol()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbolRef, context));
		}
	}
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCMemberExpression {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Object;
	}

	getType() {
		return undefined;
	}

	index(document: UCDocument, _context?: UCStructSymbol) {
		this.symbolRef.setReference(
			document.class!,
			document, undefined, true
		);
	}
}

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPredefinedPropertyAccessExpression extends UCMemberExpression {
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Object;
	}

	getType() {
		return undefined;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (context) {
			this.symbolRef.setReference(
				context instanceof UCClassSymbol
					? context
					: document.class!,
				document, undefined, true
			);
		}
	}
}

// TODO: Support super state
export class UCSuperExpression extends UCExpression {
	public classRef?: UCObjectTypeSymbol;

	// Resolved super class.
	private superClass?: UCClassSymbol;

	getMemberSymbol() {
		return this.superClass;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Class;
	}

	getType() {
		return undefined;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.classRef && this.classRef.getSymbolAtPos(position) as UCObjectTypeSymbol) {
			return this.classRef;
		}
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (this.classRef) {
			this.classRef.index(document, context!);
			this.superClass = this.classRef.getReference() as UCClassSymbol;
		} else {
			// TODO: Can super refer to a parent STATE?
			this.superClass = document.class!.super;
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		this.classRef && this.classRef.analyze(document, context);
	}
}

export class UCNewExpression extends UCCallExpression {
	// TODO: Implement pseudo new operator for hover info?
	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Object;
	}

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
	getValue(): number {
		return Number.parseInt(this.context.text);
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Float;
	}
}

export class UCIntLiteral extends UCLiteral {
	getValue(): number {
		return Number.parseInt(this.context.text);
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}
}

export class UCByteLiteral extends UCLiteral {
	getValue(): number {
		return Number.parseInt(this.context.text);
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

	getTypeFlags(): UCTypeFlags {
		return this.castRef.getTypeFlags();
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
				document.nodes.push(new UnrecognizedFieldNode(this.objectRef));
			}
			else if (castSymbol === NativeClass && !(objectSymbol instanceof UCClassSymbol)) {
				document.nodes.push(new SemanticErrorNode(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not a class!`));
			}
			else if (castSymbol === NativeEnum && !(objectSymbol instanceof UCEnumSymbol)) {
				document.nodes.push(new SemanticErrorNode(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not an enum!`));
			}
		}

		if (!castSymbol) {
			document.nodes.push(new UnrecognizedTypeNode(this.castRef));
		}
	}
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
	structType: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.structType.getReference();
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Struct;
	}

	getType() {
		return this.structType;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getReference() && this.structType as ISymbol;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		if (!this.structType || this.structType.getReference()) {
			return;
		}

		const symbol = context!.findSuperSymbol(this.structType.getId());
		symbol && this.structType.setReference(symbol, document, undefined, undefined, this.getRange());
	}

	analyze(_document: UCDocument, _context?: UCStructSymbol): void {
	}
}

export class UCDefaultStructLiteral extends UCExpression {
	public arguments?: Array<IExpression | undefined>;

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Struct;
	}

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

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef && this.argumentRef.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		super.index(document, context);
		this.argumentRef && this.argumentRef.index(document, context!);
	}

	// TODO: Validate that referred property is a valid static array!
	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context);
		this.argumentRef && this.argumentRef.analyze(document, context!);
	}
}

export class UCNameOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Name;
	}

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef && this.argumentRef.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		super.index(document, context);
		this.argumentRef && this.argumentRef.index(document, context!);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context);
		this.argumentRef && this.argumentRef.analyze(document, context!);
	}
}

export class UCSizeOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getValue() {
		// FIXME: We don't have the data to calculate a class's size.
		// const symbol = this.argumentRef && this.argumentRef.getReference();
		return undefined;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Int;
	}

	getType() {
		return this.argumentRef;
	}

	getContainedSymbolAtPos(position: Position) {
		return this.argumentRef && this.argumentRef.getSymbolAtPos(position) && this.argumentRef;
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		super.index(document, context);
		this.argumentRef && this.argumentRef.index(document, context!);
	}

	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context);
		this.argumentRef && this.argumentRef.analyze(document, context!);
	}
}

export class UCMetaClassExpression extends UCParenthesizedExpression {
	public classRef?: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.classRef && this.classRef.getReference() || NativeClass;
	}

	getTypeFlags(): UCTypeFlags {
		return UCTypeFlags.Class;
	}

	getType() {
		return this.classRef;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef && this.classRef.getSymbolAtPos(position) as UCObjectTypeSymbol;
		return subSymbol && subSymbol.getReference() && this.classRef || super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol, info?) {
		super.index(document, context);
		this.classRef && this.classRef.index(document, context!);
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context?: UCStructSymbol, info?) {
		super.analyze(document, context);
		this.classRef && this.classRef.analyze(document, context);
	}
}