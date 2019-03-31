import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { UCDocument } from '../DocumentListener';
import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCSymbolReference, UCStateSymbol, UCEnumSymbol, SymbolsTable, UCMethodSymbol, UCClassSymbol } from '.';
import { UnrecognizedFieldNode } from '../diagnostics/diagnostics';
import { intersectsWith, rangeFromBounds } from '../helpers';

export interface IExpression {
	outer?: IExpression;
	context?: ParserRuleContext;

	getSymbolAtPos(position: Position): UCSymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCExpression implements IExpression {
	outer?: IExpression;
	context?: ParserRuleContext;

	constructor(private range?: Range) {

	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		console.assert(this.range, 'No range for this expression!');
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	abstract getContainedSymbolAtPos(position: Position): UCSymbol | undefined;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;

	getOuter<T extends IExpression>(): T | undefined {
		for (let outer = this.outer; outer; outer = outer.outer) {
			if (<T>(outer)) {
				return outer as T;
			}
		}
	}
}

export class UCUnaryExpression extends UCExpression {
	public expression: UCPrimaryExpression;

	// TODO: Linkup?
	public operatorId: UCMemberExpression;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
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

export class UCPrimaryExpression extends UCExpression {
	// Points to expression within: "OPEN_PARENS expression CLOSE_PARENS" or "OPEN_BRACKET expression CLOSE_BRACKET"
	public expression?: UCExpression;
	public member?: UCMemberExpression;
	public arguments?: UCExpression[];
	public withArgument?: boolean;
	public withIndex?: boolean; // @this.expression points to our index expression i.e. [expression]

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.member) {
			const symbol = this.member.getSymbolAtPos(position);
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

		if (this.arguments) for (let arg of this.arguments) {
			const symbol = arg.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.member) this.member.index(document, context);

		if (this.expression) this.expression.index(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.member) this.member.analyze(document, context);

		if (this.expression) this.expression.analyze(document, context);
		if (this.arguments) for (let arg of this.arguments) {
			arg.analyze(document, context);
		}
	}

	getMemberSymbol(): UCSymbol | undefined {
		const symbol = this.member && this.member.getSymbol();
		return symbol ? symbol.getReference() as UCSymbol : undefined;
	}
}

export class UCContextExpression extends UCExpression {
	public left?: UCExpression;
	public member?: UCMemberExpression;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
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
		if (this.member) this.member.index(document, this.getLeftMemberType());
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.member) this.member.analyze(document, this.getLeftMemberType());
	}

	getMemberSymbol(): UCSymbol | undefined {
		const symbol = this.member && this.member.getSymbol();
		return symbol ? symbol.getReference() as UCSymbol : undefined;
	}

	getLeftMemberSymbol(): UCSymbol | undefined {
		const contextExpr = this.left;
		if (contextExpr && (contextExpr instanceof UCPrimaryExpression || contextExpr instanceof UCContextExpression)) {
			const symbol = contextExpr.getMemberSymbol();
			return symbol;
		}
		return undefined;
	}

	// Assumes that a reference is a valid instance of UCStructSymbol.
	// TODO: Resolve to the default Core.Object if type is a class limiter.
	getLeftMemberType(): UCStructSymbol | undefined {
		const symbol = this.getLeftMemberSymbol();
		if (!symbol) {
			return undefined;
		}

		// Try to resolve to the referred symbol's defined type.
		if (symbol instanceof UCPropertySymbol) {
			if (!symbol.type) return undefined;

			if (symbol.type.baseType && this.left instanceof UCPrimaryExpression && this.left.withIndex) {
				return symbol.type.baseType.getReference() as UCStructSymbol;
			}
			return symbol.type.getReference() as UCStructSymbol;
		}

		if (symbol instanceof UCMethodSymbol) {
			if (!symbol.returnType) return undefined;

			if (symbol.returnType.baseType && this.left instanceof UCPrimaryExpression && this.left.withIndex) {
				return symbol.returnType.baseType.getReference() as UCStructSymbol;
			}
			return symbol.returnType.getReference() as UCStructSymbol;
		}

		if (symbol instanceof UCEnumSymbol) {
			return symbol as UCStructSymbol;
		}

		// Only for castings
		if (symbol instanceof UCStructSymbol /* && this.expression instanceof UCPrimaryExpression && this.expression.withArgument */) {
			return symbol as UCStructSymbol;
		}
	}
}

export class UCTernaryExpression extends UCExpression {
	public condition?: UCExpression;
	public left?: UCExpression;
	public right?: UCExpression;

	getContainedSymbolAtPos(position: Position) {
		if (this.condition) {
			const symbol = this.condition.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
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
		if (this.condition) this.condition.index(document, context);
		if (this.left) this.left.index(document, context);
		if (this.right) this.right.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.condition) this.condition.analyze(document, context);
		if (this.left) this.left.analyze(document, context);
		if (this.right) this.right.analyze(document, context);
	}
}

export class UCBinaryExpression extends UCExpression {
	public left?: UCExpression;
	public right?: UCExpression;

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

export class UCMemberExpression extends UCExpression {
	private symbolRef: UCSymbolReference;

	getContainedSymbolAtPos(_position: Position) {
		return this.symbolRef;
	}

	setSymbol(symbol: UCSymbolReference) {
		// FIXME: is this needed?
		// symbol.outer = this;
		this.symbolRef = symbol;
	}

	getSymbol() {
		return this.symbolRef;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		const id = this.symbolRef.getName().toLowerCase();
		switch (id) {
			case 'default': case 'static': case 'const': {
				// FIXME: G.Static does not reference to the static class of G where g is a property of type "class<GameInfo>".
				this.symbolRef.setReference(context instanceof UCClassSymbol ? context : document.class, document);
				break;
			}

			case 'self': case 'global': {
				this.symbolRef.setReference(document.class, document);
				break;
			}

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
				// FIXME: withArgument is false sometimes!
				const outer = this.getOuter<UCPrimaryExpression>();
				const hasArguments = outer && outer.withArgument;
				if (hasArguments) {
					let type = SymbolsTable.findQualifiedSymbol(id, true); // Look for a class or predefined type.
					if (!type) {
						type = context.findTypeSymbol(id, true); // look for struct types
					}

					if (type) {
						this.symbolRef.setReference(type, document);
						return;
					}
				}

				// FIXME: we are receiving a context pointing to a predefined type sometimes?
				if (!(context instanceof UCStructSymbol)) {
					console.log('invalid context ' + this.symbolRef.getTooltip());
					return;
				}

				const symbol = context.findSuperSymbol(id);
				if (symbol) {
					this.symbolRef.setReference(symbol, document, {
						// FIXME: pass a contextinfo instance to link()
						inAssignment:
							(this.outer.outer instanceof UCAssignmentExpression
								&& this.outer.outer.left === this.outer)
							||
							(this.outer.outer instanceof UCContextExpression
								&& this.outer.outer.outer instanceof UCAssignmentExpression
								&& this.outer.outer.outer.left === this.outer.outer)
					});
				}
			}
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (!this.symbolRef.getReference()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbolRef, context));
		}
	}
}