import { Position } from 'vscode-languageserver';

import { UCDocument } from '../DocumentListener';
import { UCSymbol, UCStructSymbol } from '.';
import { UCExpression } from './Expressions';
import { intersectsWith } from '../helpers';

export class UCScriptBlock extends UCSymbol {
	public statements: UCStatement[] = [];

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!intersectsWith(this.getSpanRange(), position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let sm of this.statements) {
			const symbol = sm.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		for (let sm of this.statements) {
			sm.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		for (let sm of this.statements) {
			sm.analyze(document, context);
		}
	}
}

export abstract class UCStatement extends UCSymbol {
	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!intersectsWith(this.getSpanRange(), position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}
}

export class UCExpressionStatement extends UCStatement {
	public expression?: UCExpression;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.expression) {
			const symbol = this.expression.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) {
			this.expression.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.expression) {
			this.expression.analyze(document, context);
		}
	}
}

export class UCBlockStatement extends UCExpressionStatement {
	public scriptBlock: UCScriptBlock;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.scriptBlock) {
			return this.scriptBlock.getSymbolAtPos(position);
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.scriptBlock) {
			this.scriptBlock.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.scriptBlock) {
			this.scriptBlock.analyze(document, context);
		}
	}
}

export class UCIfStatement extends UCBlockStatement {
	public elseStatement?: UCElseStatement;

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.elseStatement) {
			return this.elseStatement.getSymbolAtPos(position);
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.elseStatement) {
			this.elseStatement.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
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

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		const symbol = super.getContainedSymbolAtPos(position);
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

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.initExpression) this.initExpression.index(document, context);
		if (this.nextExpression) this.nextExpression.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.initExpression) this.initExpression.index(document, context);
		if (this.nextExpression) this.nextExpression.analyze(document, context);
	}
}

export class UCForEachStatement extends UCBlockStatement {

}

export class UCLabeledStatement extends UCStatement {

}