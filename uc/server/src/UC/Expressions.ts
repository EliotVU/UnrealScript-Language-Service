import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { connection } from '../server';
import { UCDocument, getEnumMember } from './DocumentListener';
import { UnrecognizedFieldNode, UnrecognizedTypeNode, SemanticErrorNode } from './diagnostics/diagnostics';
import { intersectsWith, rangeFromBounds } from './helpers';

import {
	UCTypeSymbol,
	UCStructSymbol,
	UCPropertySymbol,
	UCSymbolReference,
	UCMethodSymbol,
	UCClassSymbol,
	NativeClass,
	VectorType, RotatorType, RangeType,
	VectMethodLike, RotMethodLike, RngMethodLike,
	AssignmentOperator,
	SymbolsTable,
	NativeArray,
	NativeEnum,
	UCEnumSymbol,
} from './Symbols';
import { ISymbolContext, ISymbol } from './Symbols/ISymbol';
import { UCTypeKind } from './Symbols/TypeKind';

export interface IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	getMemberSymbol(): ISymbol | undefined;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context?: UCStructSymbol): void;
	analyze(document: UCDocument, context?: UCStructSymbol): void;
}

export abstract class UCExpression implements IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	constructor(protected range?: Range) {
	}

	getMemberSymbol(): ISymbol | undefined {
		return undefined;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		if (!intersectsWith(this.range!, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getTypeKind(): UCTypeKind {
		return UCTypeKind.Error;
	}

	abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	abstract index(document: UCDocument, context?: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context?: UCStructSymbol): void;
}

export class UCParenthesizedExpression extends UCExpression {
	public expression?: IExpression;

	getMemberSymbol() {
		return this.expression && this.expression.getMemberSymbol();
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

export class UCCallExpression extends UCExpression {
	public expression?: IExpression;
	public arguments?: IExpression[];

	getMemberSymbol() {
		return this.expression && this.expression.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.index(document, context);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.analyze(document, context);
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

			if (symbol.type.baseType) {
				return symbol.type.baseType.getReference() as UCStructSymbol;
			}
			return symbol.type.getReference() as UCStructSymbol;
		}

		if (symbol instanceof UCMethodSymbol) {
			if (!symbol.returnType) return undefined;

			if (symbol.returnType.baseType) {
				return symbol.returnType.baseType.getReference() as UCStructSymbol;
			}
			return symbol.returnType.getReference() as UCStructSymbol;
		}
		return symbol;
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
		if (this.member) this.member.index(document, this.getContextType());
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.member) this.member.analyze(document, this.getContextType());
	}

	getContextType(): UCStructSymbol | undefined {
		const symbol = this.left && this.left.getMemberSymbol();
		if (!symbol) {
			connection.console.log("Couldn't resolve context " + this.context.text);
		}

		// Resolve properties to its defined type
		// e.g. given property "local array<Vector> Foo;"
		// -- will be resolved to array or Vector (in an index expression, handled elsewhere).
		if (symbol instanceof UCPropertySymbol) {
			if (symbol.type) {
				return ((symbol.type.getReference() !== NativeArray && symbol.type.baseType)
					? symbol.type.baseType.getReference()
					: symbol.type.getReference()) as UCStructSymbol;
			}
			return undefined;
		}
		if (symbol instanceof UCMethodSymbol) {
			if (symbol.returnType) {
				return (symbol.returnType.baseType
					? symbol.returnType.baseType.getReference()
					: symbol.returnType.getReference()) as UCStructSymbol;
			}
			return undefined;
		}
		return symbol as UCStructSymbol;
	}
}

export class UCConditionalExpression extends UCExpression {
	public condition: IExpression;
	public true?: IExpression;
	public false?: IExpression;

	getMemberSymbol() {
		return (this.true && this.true.getMemberSymbol()) || (this.false && this.false.getMemberSymbol());
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

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;

	// TODO: Linkup?
	public operator: UCSymbolReference;

	getMemberSymbol() {
		return this.expression.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator.getSymbolAtPos(position);
		if (symbol && this.operator.getReference()) {
			return symbol;
		}
		return this.expression && this.expression.getSymbolAtPos(position);
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		const operatorSymbol = context!.findSuperSymbol(this.operator.getId());
		operatorSymbol && this.operator.setReference(operatorSymbol, document);
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
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
		const operatorSymbol = context!.findSuperSymbol(this.operator.getId());
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
	index(document: UCDocument, context?: UCStructSymbol) {
		super.index(document, context);

		if (!this.operator.getReference()) {
			this.operator.setReference(AssignmentOperator, document);
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		super.analyze(document, context);

		// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
		const letSymbol = this.left && this.left.getMemberSymbol();
		if (letSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// Properties with a defined array dimension cannot be assigned!
				if (letSymbol.arrayDim) {
					document.nodes.push(new SemanticErrorNode(letSymbol, "Cannot assign to a static array variable."));
				}

				if (letSymbol.isConst()) {
					document.nodes.push(new SemanticErrorNode(letSymbol, "Cannot assign to a constant variable."));
				}
			} else {
				// TODO: handle case for dynamic arrays
				// document.nodes.push(new SemanticErrorNode(letSymbol, "Cannot be assigned to, because it is not a variable."));
			}
		}
	}
}

export class UCLiteral extends UCExpression {
	getMemberSymbol() {
		return undefined;
	}

	getContainedSymbolAtPos(_position: Position) {
		return undefined;
	}

	index(_document: UCDocument, _context?: UCStructSymbol): void {}
	analyze(_document: UCDocument, _context?: UCStructSymbol): void {}
}

export class UCObjectLiteral extends UCExpression {
	public castRef: UCSymbolReference;
	public objectRef: UCSymbolReference;

	getMemberSymbol() {
		return this.objectRef.getReference() || this.castRef.getReference() || NativeClass;
	}

	getContainedSymbolAtPos(position: Position) {
		if (intersectsWith(this.castRef.getSpanRange(), position)) {
			return this.castRef.getReference() && this.castRef;
		}

		if (intersectsWith(this.objectRef.getSpanRange(), position)) {
			return this.objectRef.getReference() && this.objectRef;
		}
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		const castSymbol = SymbolsTable.findSymbol(this.castRef.getId(), true);
		if (castSymbol) {
			this.castRef.setReference(castSymbol, document);
		}

		const objectSymbol = castSymbol !== NativeEnum
			? SymbolsTable.findSymbol(this.objectRef.getId(), true)
			// FIXME: This is wrong, does not support subgroups.
			// Might need to add enum declarations to the SymbolsTable instead.
			: context!.findTypeSymbol(this.objectRef.getId(), true);
		if (objectSymbol) {
			this.objectRef.setReference(objectSymbol, document);
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, _context?: UCStructSymbol) {
		const castSymbol = this.castRef.getReference();
		const objectSymbol = this.objectRef.getReference();

		if (!objectSymbol) {
			document.nodes.push(new UnrecognizedFieldNode(this.objectRef));
		}
		else if (castSymbol === NativeClass && !(objectSymbol instanceof UCClassSymbol)) {
			document.nodes.push(new SemanticErrorNode(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not a class!`));
		}
		else if (castSymbol === NativeEnum && !(objectSymbol instanceof UCEnumSymbol)) {
			document.nodes.push(new SemanticErrorNode(this.objectRef, `Type of '${objectSymbol.getQualifiedName()}' is not an enum!`));
		}

		if (!castSymbol) {
			document.nodes.push(new UnrecognizedTypeNode(this.castRef));
		}
	}
}

export class UCMemberExpression extends UCExpression {
	constructor (protected symbolRef: UCSymbolReference) {
		super(symbolRef.getNameRange());
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.symbolRef.getReference() && this.symbolRef;
	}

	getMemberSymbol() {
		return this.symbolRef.getReference();
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (!context) {
			return;
		}

		try {
			const id = this.symbolRef.getId();
			// First try to match a class or struct (e.g. a casting).
			const hasArguments = this.outer instanceof UCCallExpression;
			if (hasArguments) {
				// look for a predefined or struct/class type.
				// FIXME: What about casting a byte to an ENUM type?
				const type = SymbolsTable.findSymbol(id, true);
				// Disabled, i don't think this reflects the correct lookup behavior as the UnrealScript-compiler.
				// || context.findTypeSymbol(id, true);
				if (type) {
					this.symbolRef.setReference(type, document);
					return;
				}
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
		} catch (err) {
			connection.console.error('(' + document.uri + ')' + ' An unexpected indexing error occurred ' + JSON.stringify(err));
		}
	}

	analyze(document: UCDocument, context?: UCStructSymbol) {
		if (!this.getMemberSymbol()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbolRef, context));
		}
	}
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCMemberExpression {
	index(document: UCDocument, _context?: UCStructSymbol) {
		this.symbolRef.setReference(
			document.class!,
			document
		);
	}
}

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPredefinedPropertyAccessExpression extends UCMemberExpression {
	index(document: UCDocument, context?: UCStructSymbol) {
		if (context) {
			this.symbolRef.setReference(
				context instanceof UCClassSymbol
					? context
					: document.class!,
				document
			);
		}
	}
}

export class UCSuperExpression extends UCExpression {
	public classRef?: UCTypeSymbol;

	// Resolved super class.
	private superClass?: UCClassSymbol;

	getMemberSymbol() {
		return this.superClass;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.classRef && this.classRef.getSymbolAtPos(position) as UCTypeSymbol) {
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
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
	structType: UCSymbolReference;

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getReference() && this.structType;
	}

	getMemberSymbol() {
		return this.structType.getReference();
	}

	index(document: UCDocument, context?: UCStructSymbol) {
		if (!this.structType || this.structType.getReference()) {
			return;
		}

		const symbol = context!.findTypeSymbol(this.structType.getId(), true);
		this.structType['nameRange'] = this.range!; // HACK!
		symbol && this.structType.setReference(symbol, document);
	}

	analyze(_document: UCDocument, _context?: UCStructSymbol): void {
	}
}

export class UCVectLiteral extends UCStructLiteral {
	structType = VectorType;

	getContainedSymbolAtPos(_position: Position) {
		return VectMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRotLiteral extends UCStructLiteral {
	structType = RotatorType;

	getContainedSymbolAtPos(_position: Position) {
		return RotMethodLike as unknown as UCSymbolReference;
	}
}

export class UCRngLiteral extends UCStructLiteral {
	structType = RangeType;

	getContainedSymbolAtPos(_position: Position) {
		return RngMethodLike as unknown as UCSymbolReference;
	}
}

export class UCMetaClassExpression extends UCParenthesizedExpression {
	public classRef: UCTypeSymbol;

	getMemberSymbol() {
		return this.classRef.getReference() || NativeClass;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef && this.classRef.getSymbolAtPos(position) as UCTypeSymbol;
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