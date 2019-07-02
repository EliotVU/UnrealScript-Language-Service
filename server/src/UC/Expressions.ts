import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { UnrecognizedFieldNode, UnrecognizedTypeNode, SemanticErrorNode, ExpressionErrorNode } from './diagnostics/diagnostics';
import { getEnumMember } from './indexer';
import { intersectsWith, rangeFromBounds } from './helpers';
import { UCDocument } from './document';
import { Name } from './names';

import {
	ISymbolContext, ISymbol,
	UCObjectTypeSymbol,
	UCStructSymbol,
	UCPropertySymbol,
	UCSymbolReference,
	UCMethodSymbol,
	UCClassSymbol,
	SymbolsTable,
	UCEnumSymbol,
	UCSymbol,
	NativeArray,
	NativeClass,
	NativeEnum,
	VectorTypeRef,
	VectMethodLike,
	RotatorTypeRef,
	RotMethodLike,
	RangeTypeRef,
	RngMethodLike,
	ITypeSymbol, TypeCastMap, UCTypeKind
} from './Symbols';

export interface IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	getRange(): Range | undefined;

	getMemberSymbol(): ISymbol | undefined;
	getTypeKind(): UCTypeKind;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context?: UCStructSymbol): void;
	analyze(document: UCDocument, context?: UCStructSymbol): void;
}

export abstract class UCExpression implements IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	constructor(protected range?: Range) {
	}

	getRange(): Range {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		return this.range!;
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Error;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	abstract index(document: UCDocument, context?: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context?: UCStructSymbol): void;

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

	getTypeKind(): UCTypeKind {
		return this.expression && this.expression.getTypeKind() || UCTypeKind.Error;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.expression && this.expression.getSymbolAtPos(position);
		return symbol;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
	}
}

export class UCArrayCountExpression extends UCParenthesizedExpression {

}

export class UCCallExpression extends UCExpression {
	public expression?: IExpression;
	public arguments?: Array<IExpression | undefined>;

	getMemberSymbol() {
		return this.expression && this.expression.getMemberSymbol();
	}

	getTypeKind(): UCTypeKind {
		return this.expression && this.expression.getTypeKind() || UCTypeKind.Error;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg && arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg && arg.index(document, context);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg && arg.analyze(document, context);
		}
	}
}

export class UCElementAccessExpression extends UCExpression {
	public expression?: IExpression;
	public argument?: IExpression;

	getMemberSymbol() {
		const symbol = this.expression && this.expression.getMemberSymbol();

		// Try to resolve to the referred symbol's defined type.
		if (symbol instanceof UCPropertySymbol) {
			if (!symbol.type) return undefined;

			if (symbol.type instanceof UCObjectTypeSymbol && symbol.type.baseType) {
				return symbol.type.baseType.getReference() as UCStructSymbol;
			}
			return symbol.type.getReference() as UCStructSymbol;
		}

		if (symbol instanceof UCMethodSymbol) {
			if (!symbol.returnType) return undefined;

			if (symbol.returnType instanceof UCObjectTypeSymbol && symbol.returnType.baseType) {
				return symbol.returnType.baseType.getReference() as UCStructSymbol;
			}
			return symbol.returnType.getReference() as UCStructSymbol;
		}
		return symbol;
	}

	getTypeKind(): UCTypeKind {
		return this.expression && this.expression.getTypeKind() || UCTypeKind.Error;
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

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
		if (this.argument) this.argument.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
		if (this.argument) this.argument.analyze(document, context);
	}
}

export class UCPropertyAccessExpression extends UCExpression {
	public left?: IExpression;
	public member?: UCMemberExpression;

	getMemberSymbol() {
		return this.member && this.member.getMemberSymbol();
	}

	getTypeKind(): UCTypeKind {
		return this.member && this.member.getTypeKind() || UCTypeKind.Error;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.left) {
			const symbol = this.left.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.member) {
			const symbol = this.member.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.left) this.left.index(document, context);

		const memberContext = this.getContextType();
		if (this.member && memberContext instanceof UCStructSymbol) {
			this.member.index(document, memberContext);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);

		const memberContext = this.getContextType();
		if (this.member) {
			this.member.analyze(document, memberContext as UCStructSymbol);
		}
	}

	getContextType(): ISymbol | undefined {
		const symbol = this.left && this.left.getMemberSymbol();
		if (!symbol) {
			return undefined;
		}

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

	getTypeKind(): UCTypeKind {
		return this.true && this.true.getTypeKind() || UCTypeKind.Error;
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

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.condition) this.condition.index(document, context);
		if (this.true) this.true.index(document, context);
		if (this.false) this.false.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.condition) this.condition.analyze(document, context);
		if (this.true) this.true.analyze(document, context);
		if (this.false) this.false.analyze(document, context);
	}
}

function findOperatorSymbol(id: Name, scope: UCStructSymbol): UCSymbol | undefined {
	// TODO: What about UCState? Can states properly declare operators?
	const classContext = scope.outer;
	// Because we only need to match operators, we can directly skip @context and look in the upper class.
	return classContext instanceof UCStructSymbol ? classContext.findSuperSymbol(id) : undefined;
}

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;
	public operator?: UCSymbolReference;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getTypeKind(): UCTypeKind {
		// TODO: Return operator's return type
		return this.expression && this.expression.getTypeKind() || UCTypeKind.Error;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator && this.operator.getSymbolAtPos(position);
		if (symbol && this.operator!.getReference()) {
			return symbol;
		}
		return this.expression && this.expression.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.operator) {
			const operatorSymbol = findOperatorSymbol(this.operator.getId(), context!);
			operatorSymbol && this.operator.setReference(operatorSymbol, document);
		}
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		// TODO: missing operator?
		if (this.expression) this.expression.analyze(document, context);
	}
}

// TODO: Index and match overloaded operators.
export class UCBinaryExpression extends UCExpression {
	public left?: IExpression;
	public operator: UCSymbolReference;
	public right?: IExpression;

	getMemberSymbol() {
		// TODO: Return the operator's return type.
		return (this.left && this.left.getMemberSymbol()) || (this.right && this.right.getMemberSymbol());
	}

	getTypeKind(): UCTypeKind {
		// TODO: requires proper overloaded operator linking, then should return the type of the operator.
		return UCTypeKind.Error;
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator.getSymbolAtPos(position);
		if (symbol && this.operator.getReference()) {
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

	index(document: UCDocument, context?: UCStructSymbol) {
		// Because we only need to match operators, we can directly skip @context and look in the upper class.
		const operatorSymbol = findOperatorSymbol(this.operator.getId(), context!);
		operatorSymbol && this.operator.setReference(operatorSymbol, document);

		if (this.left) this.left.index(document, context);
		if (this.right) this.right.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.right) this.right.analyze(document, context);
	}
}

export class UCAssignmentExpression extends UCBinaryExpression {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Error;
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);

		// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
		if (!this.left) {
			document.nodes.push(new ExpressionErrorNode(this, "Missing left expression!"));
			return;
		}

		const letType = this.left.getTypeKind();
		const letSymbol = this.left.getMemberSymbol();
		if (letSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// Properties with a defined array dimension cannot be assigned!
				if (letSymbol.isFixedArray()) {
					document.nodes.push(new SemanticErrorNode(letSymbol, "Cannot assign to a static array variable."));
				}

				if (letSymbol.isConst()) {
					document.nodes.push(new SemanticErrorNode(letSymbol, "Cannot assign to a constant variable."));
				}
			} else if (letSymbol instanceof UCMethodSymbol) {
				// TODO: Distinguish a delegate from a regular method!
				// TODO: throw error unless it's a delegate.
			} else {
				// AN ElementAccessExpression does not return the property but its type that's being assigned, in this case such assignments are legal.
				// -- but elsewhere, assigning a type is illegal!
				if (this.left instanceof UCElementAccessExpression) {

				} else {
					document.nodes.push(new ExpressionErrorNode(this.left!, `Cannot assign to expression (type: '${UCTypeKind[letType]}'), because it is not a variable.`));
				}
			}
		} else {
			if (letType === UCTypeKind.Object) {
				// TODO:
			}
			else {
				document.nodes.push(new ExpressionErrorNode(this.left!, `Cannot assign to expression (type: '${UCTypeKind[letType]}'), because it is not a variable.`));
			}
		}

		if (!this.right) {
			document.nodes.push(new ExpressionErrorNode(this, "Missing right expression!"));
			return;
		}
	}
}

export class UCMemberExpression extends UCExpression {
	constructor(protected symbolRef: UCSymbolReference) {
		super(symbolRef.getRange());
	}

	getMemberSymbol() {
		return this.symbolRef.getReference();
	}

	getTypeKind(): UCTypeKind {
		// TODO: Redirect to getMemberSymbol().getTypeKind()
		return UCTypeKind.Object;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.symbolRef.getReference() && this.symbolRef;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		const id = this.symbolRef.getId();
		const hasArguments = this.outer instanceof UCCallExpression;
		if (hasArguments) {
			// We must match a predefined type over any class or scope symbol!
			// FIXME: What about casting a byte to an ENUM type?
			let type: ISymbol | undefined = TypeCastMap.get(id) || SymbolsTable.findSymbol(id, true);
			if (type) {
				this.symbolRef.setReference(type, document);
				return;
			}
		}

		if (!context) {
			return;
		}

		let symbol = context.findSuperSymbol(id);
		if (!symbol) {
			// FIXME: only lookup an enumMember if the context value is either an enum, byte, or int.
			symbol = getEnumMember(id);
		}

		if (symbol) {
			let contextInfo: ISymbolContext;
			contextInfo = {
				inAssignment:
					// Check if we are being assigned a value.
					// FIXME: This is very ugly and should instead be determined by passing down a more verbose context to index().
					(this.outer instanceof UCAssignmentExpression && this.outer.left === this)
					|| this.outer instanceof UCPropertyAccessExpression
					&& this.outer.member === this
					&& this.outer.outer instanceof UCAssignmentExpression
					&& this.outer.outer.left === this.outer
			};
			this.symbolRef.setReference(symbol, document, contextInfo);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol | ISymbol) {
		if (context && !(context instanceof UCStructSymbol)) {
			document.nodes.push(new SemanticErrorNode(this.symbolRef, `'${context.getQualifiedName()}' is an inaccessible type!`));
		} else if (!context || !this.getMemberSymbol()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbolRef, context));
		}
	}
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCMemberExpression {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Object;
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
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Object;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
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

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Class;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.classRef && this.classRef.getSymbolAtPos(position) as UCObjectTypeSymbol) {
			return this.classRef;
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.classRef) {
			this.classRef.index(document, context!);
			this.superClass = this.classRef.getReference() as UCClassSymbol;
		} else {
			// TODO: Can super refer to a parent STATE?
			this.superClass = document.class!.super;
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context?: UCStructSymbol) {
		this.classRef && this.classRef.analyze(document, context);
	}
}

export class UCNewExpression extends UCCallExpression {
	// TODO: Implement pseudo new operator for hover info?
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Object;
	}
}

export abstract class UCLiteral extends UCExpression {
	getValue(): number | undefined {
		return undefined;
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
		return undefined;
	}

	index(_document: UCDocument, _context?: UCStructSymbol): void { }
	analyze(_document: UCDocument, _context?: UCStructSymbol): void { }
}

export class UCNoneLiteral extends UCLiteral {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.None;
	}
}

export class UCStringLiteral extends UCLiteral {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.String;
	}
}

export class UCNameLiteral extends UCLiteral {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Name;
	}
}

export class UCBoolLiteral extends UCLiteral {
	getTypeKind(): UCTypeKind {
		return UCTypeKind.Bool;
	}
}

export class UCFloatLiteral extends UCLiteral {
	getValue(): number {
		return Number.parseInt(this.context.text);
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Float;
	}
}

export class UCIntLiteral extends UCLiteral {
	getValue(): number {
		return Number.parseInt(this.context.text);
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
	}
}

export class UCObjectLiteral extends UCExpression {
	public castRef: UCSymbolReference;
	public objectRef?: ITypeSymbol;

	getMemberSymbol() {
		return this.objectRef && this.objectRef.getReference() || this.castRef.getReference() || NativeClass;
	}

	getTypeKind(): UCTypeKind {
		// FIXME: Should we return objectRef's getTypeKind()?
		// -- or should we assume that we always have at the very least an OBJECT
		return UCTypeKind.Object;
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
		const castSymbol = SymbolsTable.findSymbol(this.castRef.getId(), true);
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
	structType: UCSymbolReference;

	getMemberSymbol() {
		return this.structType.getReference();
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Struct;
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getReference() && this.structType;
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (!this.structType || this.structType.getReference()) {
			return;
		}

		const symbol = context!.findSuperSymbol(this.structType.getId());
		symbol && this.structType.setReference(symbol, document, undefined, undefined, this.getRange());
	}

	analyze(_document: UCDocument, _context?: UCStructSymbol): void {
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

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
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
		this.argumentRef && this.argumentRef.analyze(document, context!);
	}
}

export class UCNameOfLiteral extends UCLiteral {
	public argumentRef?: ITypeSymbol;

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Name;
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

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Int;
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
		this.argumentRef && this.argumentRef.analyze(document, context!);
	}
}

export class UCMetaClassExpression extends UCParenthesizedExpression {
	public classRef?: UCObjectTypeSymbol;

	getMemberSymbol() {
		return this.classRef && this.classRef.getReference() || NativeClass;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Class;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef && this.classRef.getSymbolAtPos(position) as UCObjectTypeSymbol;
		return subSymbol && subSymbol.getReference() && this.classRef || super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);
		this.classRef && this.classRef.index(document, context!);
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);
		this.classRef && this.classRef.analyze(document, context);
	}
}