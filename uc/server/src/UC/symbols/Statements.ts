import { Position } from 'vscode-languageserver';

import { UCDocumentListener } from '../DocumentListener';
import { UCSymbol, UCStructSymbol } from '.';
import { UCExpression } from './Expressions';

export class UCScriptBlock extends UCSymbol {
	public statements: UCStatement[] = [];

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.intersectsWith(position)) {
			return undefined;
		}
		const symbol = this.getSubSymbolAtPos(position);
		return symbol;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let sm of this.statements) {
			const symbol = sm.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		for (let sm of this.statements) {
			sm.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		for (let sm of this.statements) {
			sm.analyze(document, context);
		}
	}
}

export class UCStatement extends UCSymbol {
	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.intersectsWith(position)) {
			return undefined;
		}
		const symbol = this.getSubSymbolAtPos(position);
		return symbol;
	}
}

export class UCExpressionStatement extends UCStatement {
	public expression?: UCExpression;

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

export class UCBlockStatement extends UCExpressionStatement {
	public scriptBlock: UCScriptBlock;

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getSubSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.scriptBlock) {
			return this.scriptBlock.getSymbolAtPos(position);
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);
		if (this.scriptBlock) {
			this.scriptBlock.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.scriptBlock) {
			this.scriptBlock.analyze(document, context);
		}
	}
}

export class UCIfStatement extends UCBlockStatement {
	public elseStatement?: UCElseStatement;

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getSubSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.elseStatement) {
			return this.elseStatement.getSymbolAtPos(position);
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);
		if (this.elseStatement) {
			this.elseStatement.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.elseStatement) {
			this.elseStatement.analyze(document, context);
		}
	}
}

export class UCElseStatement extends UCBlockStatement {

}

export class UCDoStatement extends UCBlockStatement {

}

export class UCWhileStatement extends UCBlockStatement {

}

export class UCSwitchStatement extends UCBlockStatement {

}

export class UCSwitchCase extends UCBlockStatement {

}

export class UCForStatement extends UCBlockStatement {
	// @super.expression is the conditional if expression
	public initExpression?: UCExpression;
	public nextExpression?: UCExpression;

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getSubSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.initExpression) {
			const symbol = this.initExpression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.nextExpression) {
			const symbol = this.nextExpression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);
		if (this.initExpression) this.initExpression.link(document, context);
		if (this.nextExpression) this.nextExpression.link(document, context);
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.initExpression) this.initExpression.link(document, context);
		if (this.nextExpression) this.nextExpression.analyze(document, context);
	}
}

export class UCForEachStatement extends UCBlockStatement {

}

export class UCLabeledStatement extends UCStatement {

}