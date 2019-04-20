import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { intersectsWith, rangeFromBounds } from './helpers';
import { UCDocument } from './DocumentListener';

import { UCSymbol, UCStructSymbol } from './Symbols';
import { IExpression } from './Expressions';
import { UCScriptBlock } from './ScriptBlock';

export interface IStatement {
	// Not in use atm, but might be needed later to traverse where an expression is contained.
	outer?: IStatement;
	context?: ParserRuleContext;

	getSymbolAtPos(position: Position): UCSymbol;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCBaseStatement implements IStatement {
	outer?: IStatement;
	context?: ParserRuleContext;

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

	abstract getContainedSymbolAtPos(position: Position): UCSymbol;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;
}

export class UCExpressionStatement implements IStatement {
	outer?: IStatement;
	context?: ParserRuleContext;
	expression?: IExpression;

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

	getContainedSymbolAtPos(position: Position): UCSymbol {
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

export abstract class UCBlockStatement extends UCExpressionStatement {
	public scriptBlock: UCScriptBlock;

	getContainedSymbolAtPos(position: Position): UCSymbol {
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
	public else?: UCElseStatement;

	getContainedSymbolAtPos(position: Position): UCSymbol {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.else) {
			return this.else.getSymbolAtPos(position);
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.else) {
			this.else.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.else) {
			this.else.analyze(document, context);
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
	public break?: IStatement;

	getContainedSymbolAtPos(position: Position): UCSymbol {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.break) {
			return this.break.getSymbolAtPos(position);
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.break) {
			this.break.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.break) {
			this.break.analyze(document, context);
		}
	}
}

export class UCForStatement extends UCBlockStatement {
	// @super.expression is the conditional if expression
	public init?: IExpression;
	public next?: IExpression;

	getContainedSymbolAtPos(position: Position): UCSymbol {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.init) {
			const symbol = this.init.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}

		if (this.next) {
			const symbol = this.next.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		if (this.init) this.init.index(document, context);
		if (this.next) this.next.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.init) this.init.index(document, context);
		if (this.next) this.next.analyze(document, context);
	}
}

export class UCForEachStatement extends UCBlockStatement {

}

export class UCLabeledStatement implements IStatement {
	context?: ParserRuleContext;
	label?: string;

	constructor(private range?: Range) {

	}

	getSymbolAtPos(position: Position) {
		return undefined;
	}

	index(document: UCDocument, context: UCStructSymbol) {

	}

	analyze(document: UCDocument, context: UCStructSymbol) {

	}
}

export class UCReturnStatement extends UCExpressionStatement {

}

export class UCGotoStatement extends UCExpressionStatement {

}