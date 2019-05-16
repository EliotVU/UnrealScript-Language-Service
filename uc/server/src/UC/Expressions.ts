import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { connection } from '../server';
import { UCDocument, getEnumMember } from './DocumentListener';
import { UnrecognizedFieldNode, UnrecognizedTypeNode, SemanticErrorNode } from './diagnostics/diagnostics';
import { intersectsWith, rangeFromBounds } from './helpers';

import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCSymbolReference, SymbolsTable, UCMethodSymbol, UCClassSymbol, NativeClass, VectMethodLike, RotMethodLike, RngMethodLike, VectorType, RotatorType, RangeType, UCTypeSymbol, AssignmentOperator } from './Symbols';
import { ISymbolContext, ISymbol } from './Symbols/ISymbol';

export interface IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	getMemberSymbol(): ISymbol;

	getSymbolAtPos(position: Position): UCSymbol;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCExpression implements IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	constructor(protected range?: Range) {
	}

	getSymbolAtPos(position: Position): UCSymbol {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol as UCSymbol;
	}

	getMemberSymbol(): ISymbol {
		return undefined;
	}

	abstract getContainedSymbolAtPos(position: Position): ISymbol;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;
}

export class UCParenthesizedExpression extends UCExpression {
	public expression?: IExpression;

	getMemberSymbol(): ISymbol {
		if (!this.expression) {
			debugger;
		}
		return this.expression && this.expression.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
		const symbol = this.expression && this.expression.getSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
	}
}

export class UCCallExpression extends UCExpression {
	public expression?: IExpression;
	public arguments?: IExpression[];

	getMemberSymbol(): ISymbol {
		return this.expression && this.expression.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.analyze(document, context);
		}
	}
}

export class UCElementAccessExpression extends UCExpression {
	public expression?: IExpression;
	public argument?: IExpression;

	getMemberSymbol(): ISymbol {
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

	getContainedSymbolAtPos(position: Position): UCSymbol {
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.index(document, context);
		if (this.argument) this.argument.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
		if (this.argument) this.argument.analyze(document, context);
	}
}

export class UCPropertyAccessExpression extends UCExpression {
	public left?: IExpression;
	public member?: UCMemberExpression;

	getMemberSymbol(): ISymbol {
		return this.member.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.index(document, context);
		if (this.member) this.member.index(document, this.getContextType());
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.member) this.member.analyze(document, this.getContextType());
	}

	getContextType(): UCStructSymbol {
		const symbol = this.left && this.left.getMemberSymbol();
		if (!symbol) {
			connection.console.log("Couldn't resolve context " + this.left.context.text);
		}
		// Resolve properties to its defined type e.g. given property "local array<Vector> Foo;" will be resolved to array or Vector (in an index expression, handled elsewhere).
		if (symbol instanceof UCPropertySymbol) {
			// TODO: handle properties of type class<DamageType>.
			return symbol.type && symbol.type.getReference() as UCStructSymbol;
		}
		if (symbol instanceof UCMethodSymbol) {
			// TODO: handle properties of type class<DamageType>.
			return symbol.returnType && symbol.returnType.getReference() as UCStructSymbol;
		}
		return symbol as UCStructSymbol;
	}
}

export class UCConditionalExpression extends UCExpression {
	public condition: IExpression;
	public true?: IExpression;
	public false?: IExpression;

	getMemberSymbol(): ISymbol {
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.condition) this.condition.index(document, context);
		if (this.true) this.true.index(document, context);
		if (this.false) this.false.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.condition) this.condition.analyze(document, context);
		if (this.true) this.true.analyze(document, context);
		if (this.false) this.false.analyze(document, context);
	}
}

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;

	// TODO: Linkup?
	public operator: UCSymbolReference;

	getMemberSymbol(): ISymbol {
		return this.expression.getMemberSymbol();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.operator.getSymbolAtPos(position);
		if (symbol && this.operator.getReference()) {
			return symbol;
		}
		return this.expression && this.expression.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		this.operator.setReference(context.findSuperSymbol(this.operator.getName().toLowerCase()), document);
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) this.expression.analyze(document, context);
	}
}

// TODO: Index and match overloaded operators.
export class UCBinaryExpression extends UCExpression {
	public left?: IExpression;
	public operator: UCSymbolReference;
	public right?: IExpression;

	getMemberSymbol(): ISymbol {
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

	index(document: UCDocument, context: UCStructSymbol) {
		this.operator.setReference(context.findSuperSymbol(this.operator.getName().toLowerCase()), document);

		if (this.left) this.left.index(document, context);
		if (this.right) this.right.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.right) this.right.analyze(document, context);
	}
}

export class UCAssignmentExpression extends UCBinaryExpression {
	index(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.index(document, context);
		this.operator.setReference(AssignmentOperator, document);
		if (this.right) this.right.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);

		// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
		const letSymbol = this.left && this.left.getMemberSymbol();
		if (letSymbol) {
			if (letSymbol instanceof UCPropertySymbol) {
				// Properties with a defined array dimension cannot be assigned!
				if (letSymbol.arrayDim) {
					document.nodes.push(new SemanticErrorNode(this.operator, "Can't assign static arrays!"));
				}

				if (letSymbol.isConst()) {
					document.nodes.push(new SemanticErrorNode(this.operator, "Can't assign const Variables!"));
				}
			} else {
				// TODO: handle case for dynamic arrays
				// document.nodes.push(new SemanticErrorNode(this.operator, "Can only assign Variables!"));
			}
		}
	}
}

export class UCLiteral extends UCExpression {
	getMemberSymbol(): ISymbol {
		return undefined;
	}

	getContainedSymbolAtPos(_position: Position) {
		return undefined;
	}

	index(_document: UCDocument, _context: UCStructSymbol): void {}
	analyze(_document: UCDocument, _context: UCStructSymbol): void {}
}

export class UCClassLiteral extends UCExpression {
	public classCastingRef: UCSymbolReference;
	public objectRef: UCSymbolReference;

	getMemberSymbol(): ISymbol {
		return this.objectRef.getReference() || this.classCastingRef.getReference() || NativeClass;
	}

	getContainedSymbolAtPos(position: Position) {
		if (intersectsWith(this.objectRef.getSpanRange(), position)) {
			return this.objectRef.getReference() && this.objectRef;
		}

		if (intersectsWith(this.classCastingRef.getSpanRange(), position)) {
			return this.classCastingRef.getReference() && this.classCastingRef;
		}
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		const castSymbol = SymbolsTable.findSymbol(this.classCastingRef.getName().toLowerCase(), true);
		if (castSymbol) {
			this.classCastingRef.setReference(castSymbol, document);
		}

		const symbol = SymbolsTable.findSymbol(this.objectRef.getName().toLowerCase(), true);
		if (symbol) {
			this.objectRef.setReference(symbol, document);
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, _context: UCStructSymbol) {
		const castedClass = this.classCastingRef.getReference();
		const classSymbol = this.objectRef.getReference();

		if (!classSymbol) {
			document.nodes.push(new UnrecognizedFieldNode(this.objectRef));
		}
		else if (castedClass === NativeClass && !(classSymbol instanceof UCClassSymbol)) {
			document.nodes.push(new SemanticErrorNode(this.objectRef, `Type of '${classSymbol.getQualifiedName()}' is not a valid class!`));
		}

		if (!castedClass) {
			document.nodes.push(new UnrecognizedTypeNode(this.classCastingRef));
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

	getMemberSymbol(): ISymbol {
		return this.symbolRef.getReference();
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		try {
			const id = this.symbolRef.getName().toLowerCase();
			// First try to match a class or struct (e.g. a casting).
			const hasArguments = this.outer instanceof UCCallExpression;
			if (hasArguments) {
				// look for a predefined or struct/class type.
				// FIXME: What about casting a byte to an ENUM type?
				const type = SymbolsTable.findSymbol(id, true) || context.findTypeSymbol(id, true);
				if (type) {
					this.symbolRef.setReference(type, document);
					return;
				}
			}

			let symbol: ISymbol = context.findSuperSymbol(id);
			if (!symbol) {
				// FIXME: only lookup an enumember if the context value is either an enum, byte, or int.
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
			connection.console.error('An unexpected indexing error occurred ' + JSON.stringify(err));
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (!this.getMemberSymbol()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbolRef, context));
		}
	}
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCMemberExpression {
	index(document: UCDocument, _context: UCStructSymbol) {
		this.symbolRef.setReference(
			document.class,
			document
		);
	}
}

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPredefinedPropertyAccessExpression extends UCMemberExpression {
	index(document: UCDocument, context: UCStructSymbol) {
		this.symbolRef.setReference(
			context instanceof UCClassSymbol
				? context
				: document.class,
			document
		);
	}
}

export class UCSuperExpression extends UCExpression {
	public classRef?: UCTypeSymbol;

	// Resolved super class.
	private superClass?: UCClassSymbol;

	getMemberSymbol(): ISymbol {
		return this.superClass;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.classRef && this.classRef.getSymbolAtPos(position) as UCTypeSymbol) {
			return this.classRef;
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.classRef) {
			this.classRef.index(document, context);
			this.superClass = this.classRef.getReference() as UCClassSymbol;
		} else {
			// TODO: Can super refer to a parent STATE?
			this.superClass = document.class.super;
		}
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context: UCStructSymbol) {
		this.classRef && this.classRef.analyze(document, context);
	}
}

export class UCNewExpression extends UCCallExpression {
	// TODO: Implement psuedo new operator for hover info?
}

// Struct literals are hardcode limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
	structType: UCSymbolReference;

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.structType.getReference() && this.structType;
	}

	getMemberSymbol() {
		return this.structType.getReference();
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (!this.structType || this.structType.getReference()) {
			return;
		}

		const symbol = context.findTypeSymbol(this.structType.getName().toLowerCase(), true);
		this.structType['nameRange'] = this.range; // HACK!
		symbol && this.structType.setReference(symbol, document);
	}

	analyze(_document: UCDocument, _context: UCStructSymbol): void {
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

	getMemberSymbol(): ISymbol {
		return this.classRef.getReference() || NativeClass;
	}

	getContainedSymbolAtPos(position: Position) {
		const subSymbol = this.classRef && this.classRef.getSymbolAtPos(position) as UCTypeSymbol;
		return subSymbol && subSymbol.getReference() && this.classRef || super.getContainedSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.classRef && this.classRef.index(document, context);
	}

	// TODO: verify class type by inheritance
	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.classRef && this.classRef.analyze(document, context);
	}
}