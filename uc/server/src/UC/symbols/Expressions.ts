import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { connection } from '../../server';
import { UCDocument } from '../DocumentListener';
import { UnrecognizedFieldNode, UnrecognizedTypeNode, SemanticErrorNode } from '../diagnostics/diagnostics';
import { intersectsWith, rangeFromBounds } from '../helpers';

import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCSymbolReference, UCStateSymbol, SymbolsTable, UCMethodSymbol, UCClassSymbol, NativeClass } from '.';
import { ISymbolContext, ISymbol } from './ISymbol';

export interface IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	getMemberSymbol(): ISymbol;

	getSymbolAtPos(position: Position): UCSymbol;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCExpression {
	outer: IExpression;
	context: ParserRuleContext;

	constructor(private range?: Range) {

	}

	getSymbolAtPos(position: Position): UCSymbol {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getMemberSymbol(): ISymbol {
		return undefined;
	}

	abstract getContainedSymbolAtPos(position: Position): UCSymbol;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;
}

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;

	// TODO: Linkup?
	public operatorId: UCMemberExpression;

	getMemberSymbol(): ISymbol {
		return this.expression.getMemberSymbol();
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

export class UCGroupExpression extends UCExpression {
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

export class UCArgumentedExpression extends UCExpression {
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

export class UCIndexExpression extends UCExpression {
	public primary?: IExpression;
	public expression?: IExpression;

	getMemberSymbol(): ISymbol {
		const symbol = this.primary && this.primary.getMemberSymbol();

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
		if (this.primary) {
			const symbol = this.primary.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.primary) this.primary.index(document, context);
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.primary) this.primary.analyze(document, context);
		if (this.expression) this.expression.analyze(document, context);
	}
}

export class UCContextExpression extends UCExpression {
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
		// Resolve properties to its defined type e.g. given property "local array<Vector> Foo;" will be resolved to array or Vector (in an index expression, handled elsewhere).
		if (symbol instanceof UCPropertySymbol) {
			// TODO: handle properties of type class<DamageType>.
			return symbol.type.getReference() as UCStructSymbol;
		}
		if (symbol instanceof UCMethodSymbol) {
			// TODO: handle properties of type class<DamageType>.
			return symbol.returnType.getReference() as UCStructSymbol;
		}
		return symbol as UCStructSymbol;
	}
}

export class UCTernaryExpression extends UCExpression {
	public condition?: IExpression;
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

export class UCBinaryExpression extends UCExpression {
	public left?: IExpression;
	public right?: IExpression;

	getMemberSymbol(): ISymbol {
		return (this.left && this.left.getMemberSymbol()) || (this.right && this.right.getMemberSymbol());
	}

	getContainedSymbolAtPos(position: Position) {
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
		if (this.left) this.left.index(document, context);
		if (this.right) this.right.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.right) this.right.analyze(document, context);
	}
}

export class UCAssignmentExpression extends UCBinaryExpression {

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
		return this.objectRef.getReference() || this.classCastingRef.getReference();
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
		const castSymbol = SymbolsTable.findSymbol(this.classCastingRef.getName().toLowerCase(), true) || NativeClass;
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
			switch (id) {
				// TODO: Move to its own expression class
				case 'self': case 'global': {
					this.symbolRef.setReference(document.class, document);
					break;
				}

				// TODO: Move to its own expression class
				case 'super': {
					this.symbolRef.setReference(
						context instanceof UCStateSymbol
							? context.super
							: document.class.super,
						document
					);
					break;
				}

				default: {
					// First try to match a class or struct (e.g. a casting).
					const hasArguments = this.outer instanceof UCArgumentedExpression;
					if (hasArguments) {
						let type = SymbolsTable.findSymbol(id, true); // Look for a class or predefined type.
						if (!type) {
							type = context.findTypeSymbol(id, true); // look for struct types
						}

						if (type) {
							this.symbolRef.setReference(type, document);
							return;
						}
					}

					const symbol = context.findSuperSymbol(id);
					if (symbol) {
						let contextInfo: ISymbolContext;
							contextInfo = {
								inAssignment:
									(this.outer instanceof UCAssignmentExpression && this.outer.left === this)
									|| this.outer instanceof UCContextExpression
										&& this.outer.member === this
										&& this.outer.outer instanceof UCAssignmentExpression
										&& this.outer.outer.left === this.outer
							};
							this.symbolRef.setReference(symbol, document, contextInfo);
						}
					}
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

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPredefinedMemberExpression extends UCMemberExpression {
	index(document: UCDocument, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		this.symbolRef.setReference(
			context instanceof UCClassSymbol
				? context
				: document.class,
			document
		);
	}
}