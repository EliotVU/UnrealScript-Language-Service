import { Position } from 'vscode-languageserver';

import { UCDocumentListener } from '../DocumentListener';
import { UCStructSymbol, UCSymbol, UCPropertySymbol, UCReferenceSymbol, UCStateSymbol } from '.';
import { UnrecognizedFieldNode } from '../diagnostics/diagnostics';

export class UCExpression extends UCSymbol {
	public expression?: UCExpression;

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.isIdWithinPosition(position)) {
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
			this.symbolExpression.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);

		if (this.symbolExpression) {
			this.symbolExpression.analyze(document, context);
		}
	}

	getExpressedSymbol(): UCSymbol | undefined {
		if (this.symbolExpression && this.symbolExpression.symbol) {
			return this.symbolExpression.symbol.getReference() as UCSymbol;
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
				document.nodes.push(new UnrecognizedFieldNode(this.symbolExpression.symbol, symbol));
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
		if (this.symbolExpression && this.symbolExpression.symbol) {
			return this.symbolExpression.symbol.getReference() as UCSymbol;
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

	getExpressedContext(): UCStructSymbol | undefined {
		const symbol = this.getExpressedContextSymbol();
		if (symbol && symbol instanceof UCPropertySymbol && symbol.type) {
			const ref = symbol.type.getReference();
			if (ref && ref instanceof UCStructSymbol) {
				return ref;
			}
		} else if (symbol instanceof UCStructSymbol) {
			return symbol as UCStructSymbol;
		}
		return undefined;
	}
}

export class UCAssignmentExpression extends UCExpression {
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

// Reminder to myself, for call identifiers, match classes over functions.
export class UCSymbolExpression extends UCExpression {
	public symbol?: UCReferenceSymbol;

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isIdWithinPosition(position)) {
			return this.symbol;
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (!context) {
			return;
		}

		if (this.symbol) {
			const id = this.symbol.getName().toLowerCase();
			switch (id) {
				case 'default': case 'self': case 'static': case 'global': case 'const': {
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
					const ref = context.findSuperSymbol(id);
					if (ref) {
						this.symbol.setReference(ref, document);
					}
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