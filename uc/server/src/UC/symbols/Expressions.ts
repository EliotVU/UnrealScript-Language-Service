import { Position } from 'vscode-languageserver';

import { UCDocumentListener } from '../DocumentListener';
import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCReferenceSymbol, UCStateSymbol, NativeClass } from '.';
import { UnrecognizedFieldNode } from '../diagnostics/diagnostics';

export class UCExpression extends UCSymbol {
	public expression?: UCExpression;

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.intersectsWith(position)) {
			return undefined;
		}
		const symbol = this.getSubSymbolAtPos(position);
		return symbol;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.expression) {
			this.expression.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.expression) {
			this.expression.analyze(document, context);
		}
	}
}

export class UCUnaryExpression extends UCExpression {
	public operatorId: UCSymbolExpression;
}

export class UCPrimaryExpression extends UCExpression {
	public symbolExpression?: UCSymbolExpression;
	public arguments?: UCExpression[];

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.symbolExpression) {
			const symbol = this.symbolExpression.getSymbolAtPos(position);
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

		return super.getSubSymbolAtPos(position);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);

		if (this.symbolExpression) {
			this.symbolExpression.link(document, context);
		}

		if (this.arguments) for (let arg of this.arguments) {
			arg.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);

		if (this.symbolExpression) {
			this.symbolExpression.analyze(document, context);
		}

		if (this.arguments) for (let arg of this.arguments) {
			arg.analyze(document, context);
		}
	}

	getExpressedSymbol(): UCSymbol | undefined {
		if (this.symbolExpression && this.symbolExpression.getSymbol()) {
			return this.symbolExpression.getSymbol().getReference() as UCSymbol;
		}
		return undefined;
	}
}

export class UCContextExpression extends UCExpression {
	public symbolExpression?: UCSymbolExpression;

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.symbolExpression) {
			const symbol = this.symbolExpression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return super.getSubSymbolAtPos(position);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);

		if (this.symbolExpression) {
			this.symbolExpression.link(document, this.getExpressedContext());
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);

		context = this.getExpressedContext();
		if (!context) {
			if (this.expression) {
				let symbol = this.getExpressedContextSymbol();
				if (symbol instanceof UCPropertySymbol) {
					symbol = symbol.type;
				}
				document.nodes.push(new UnrecognizedFieldNode(this.symbolExpression.getSymbol(), symbol));
			} else {
				// Missing expression?
			}
			return;
		}

		if (this.symbolExpression) {
			this.symbolExpression.analyze(document, context);
		}
	}

	getExpressedSymbol(): UCSymbol | undefined {
		if (this.symbolExpression && this.symbolExpression.getSymbol()) {
			return this.symbolExpression.getSymbol().getReference() as UCSymbol;
		}
		return undefined;
	}

	getExpressedContextSymbol(): UCSymbol | undefined {
		const contextExpr = this.expression;
		if (contextExpr && (contextExpr instanceof UCPrimaryExpression || contextExpr instanceof UCContextExpression)) {
			let referredSymbol = contextExpr.getExpressedSymbol();
			return referredSymbol;
		}
		return undefined;
	}

	// Assumes that a reference is a valid instance of UCStructSymbol.
	getExpressedContext(): UCStructSymbol | undefined {
		const symbol = this.getExpressedContextSymbol();
		if (symbol && symbol instanceof UCPropertySymbol && symbol.type) {
			const ref = symbol.type.getReference();
			if (ref) {
				// Resolve class<TYPE> to TYPE.
				if (symbol.type.baseType && ref === NativeClass) {
					return symbol.type.baseType.getReference() as UCStructSymbol;
				}
				return ref as UCStructSymbol;
			}
		} else if (symbol instanceof UCStructSymbol) {
			return symbol as UCStructSymbol;
		}
		return undefined;
	}
}

export class UCBinaryExpression extends UCExpression {
	public leftExpression?: UCPrimaryExpression;

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.leftExpression) {
			const symbol = this.leftExpression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
		return super.getSubSymbolAtPos(position);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.leftExpression) {
			this.leftExpression.link(document, context);
		}
		super.link(document, context);
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.leftExpression) {
			this.leftExpression.analyze(document, context);
		}
		super.analyze(document, context);
	}
}

export class UCAssignmentExpression extends UCBinaryExpression {

}

// Reminder to myself, for call identifiers, match classes over functions.
export class UCSymbolExpression extends UCExpression {
	private symbol: UCReferenceSymbol;

	getSubSymbolAtPos(_position: Position): UCSymbol | undefined {
		return this.symbol;
	}

	setSymbol(symbol: UCReferenceSymbol) {
		symbol.outer = this;
		this.symbol = symbol;
	}

	getSymbol() {
		return this.symbol;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		const id = this.symbol.getName().toLowerCase();
		switch (id) {
			case 'default': case 'self': case 'static': case 'global': case 'const': {
				// FIXME: G.Static does not reference to the static class of G where g is a property of type "class<GameInfo>".
				this.symbol.setReference(document.class, document);
				break;
			}

			case 'super': {
				this.symbol.setReference(
					context instanceof UCStateSymbol
						? context.super
						: document.class.super,
					document
				);
				break;
			}

			default: {
				// If we have arguments then try to first match a class or struct (e.g. a casting).
				const isCasting = (this.outer instanceof UCPrimaryExpression && this.outer.arguments);
				if (isCasting) {
					const type = context.findTypeSymbol(id, true);
					if (type) {
						this.symbol.setReference(type, document);
						return;
					}
				}

				const ref = context.findSuperSymbol(id);
				if (ref) {
					this.symbol.setReference(ref, document, {
						// FIXME: pass a contextinfo instance to link()
						inAssignment:
							this.outer.outer instanceof UCAssignmentExpression
							|| this.outer.outer instanceof UCContextExpression
								&& this.outer.outer.outer instanceof UCAssignmentExpression
					});
				}
			}
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		if (!this.symbol.getReference()) {
			document.nodes.push(new UnrecognizedFieldNode(this.symbol, context));
		}
	}
}