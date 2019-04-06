import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { connection } from '../../server';
import { UCDocument } from '../DocumentListener';
import { UnrecognizedFieldNode } from '../diagnostics/diagnostics';
import { intersectsWith, rangeFromBounds } from '../helpers';

import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCSymbolReference, UCStateSymbol, SymbolsTable, UCMethodSymbol, UCClassSymbol } from '.';
import { ISymbolContext, ISymbol } from './ISymbol';

export interface IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	getSymbolAtPos(position: Position): UCSymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCExpression implements IExpression {
	outer: IExpression;
	context: ParserRuleContext;

	constructor(private range?: Range) {

	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.range && this.context) {
			this.range = rangeFromBounds(this.context.start, this.context.stop);
		}

		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	abstract getContainedSymbolAtPos(position: Position): UCSymbol | undefined;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;
}

export class UCUnaryExpression extends UCExpression {
	public expression: IExpression;

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

export class UCGroupExpression extends UCExpression {
	public expression: IExpression;

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

export interface IExpressesMember extends IExpression {
	getMemberSymbol(): ISymbol;
}

export class UCArgumentedExpression extends UCExpression implements IExpressesMember {
	public expression?: IExpressesMember;
	public arguments?: IExpression[];

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
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

	getMemberSymbol(): ISymbol {
		return this.expression && this.expression.getMemberSymbol();
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

export class UCIndexExpression extends UCExpression implements IExpressesMember {
	public primary?: IExpressesMember;
	public expression?: IExpression;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
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

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.primary) this.primary.index(document, context);
		if (this.expression) this.expression.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.primary) this.primary.analyze(document, context);
		if (this.expression) this.expression.analyze(document, context);
	}
}

export class UCContextExpression extends UCExpression implements IExpressesMember {
	public left?: IExpressesMember;
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
		if (this.member) this.member.index(document, this.getContextType());
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.left) this.left.analyze(document, context);
		if (this.member) this.member.analyze(document, this.getContextType());
	}

	getMemberSymbol(): ISymbol {
		const symbolRef = this.member && this.member.getSymbolRef();
		return symbolRef ? symbolRef.getReference() : undefined;
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
	public left?: IExpression;
	public right?: IExpression;

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
	public left?: IExpression;
	public right?: IExpression;

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

export class UCMemberExpression extends UCExpression implements IExpressesMember {
	constructor (private symbolRef: UCSymbolReference) {
		super(symbolRef.getNameRange());
	}

	getContainedSymbolAtPos(_position: Position) {
		// Only return if we have a RESOLVED reference.
		return this.symbolRef.getReference() && this.symbolRef;
	}

	getMemberSymbol(): ISymbol {
		return this.symbolRef.getReference();
	}

	getSymbolRef() {
		return this.symbolRef;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		try {
			const id = this.symbolRef.getName().toLowerCase();
			switch (id) {
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
					const hasArguments = this.outer instanceof UCArgumentedExpression;
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

export class UCPredefinedMemberExpression extends UCMemberExpression {
	index(document: UCDocument, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		this.getSymbolRef().setReference(
			context instanceof UCClassSymbol
				? context
				: document.class,
			document
		);
	}
}