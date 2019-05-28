import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { intersectsWith, rangeFromBounds } from './helpers';
import { UCDocument } from './DocumentListener';

import { UCStructSymbol, ISymbol } from './Symbols';
import { IExpression } from './expressions';

export interface IStatement {
	// Not in use atm, but might be needed later to traverse where an expression is contained.
	outer?: IStatement;
	context?: ParserRuleContext;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCBaseStatement implements IStatement {
	outer?: IStatement;
	context?: ParserRuleContext;

	constructor(protected range?: Range) {

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

	abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
	abstract index(document: UCDocument, context: UCStructSymbol): void;
	abstract analyze(document: UCDocument, context: UCStructSymbol): void;
}

export class UCExpressionStatement implements IStatement {
	outer?: IStatement;
	context?: ParserRuleContext;
	expression?: IExpression;

	constructor(private range?: Range) {

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

	getContainedSymbolAtPos(position: Position): ISymbol | undefined {
		const symbol = this.expression && this.expression.getSymbolAtPos(position);
		return symbol;
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

export abstract class UCThenStatement extends UCExpressionStatement {
	public then?: IStatement;

	getContainedSymbolAtPos(position: Position) {
		const symbol = super.getContainedSymbolAtPos(position);
		if (symbol) {
			return symbol;
		}

		if (this.then) {
			return this.then.getSymbolAtPos(position);
		}

		return undefined;
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.then && this.then.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.then && this.then.analyze(document, context);
	}
}

export class UCBlock extends UCBaseStatement {
	public statements?: Array<IStatement | undefined>;

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.range!, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			const symbol = statement.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			statement.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			statement.analyze(document, context);
		}
	}
}

export class UCAssertStatement extends UCExpressionStatement {

}

export class UCIfStatement extends UCThenStatement {
	public else?: IStatement;

	getContainedSymbolAtPos(position: Position) {
		return super.getContainedSymbolAtPos(position) || this.else && this.else.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.else && this.else.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.else && this.else.analyze(document, context);
	}
}

export class UCDoUntilStatement extends UCThenStatement {
	public until?: IStatement;

	getContainedSymbolAtPos(position: Position) {
		return super.getContainedSymbolAtPos(position) || this.until && this.until.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.until && this.until.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.until && this.until.analyze(document, context);
	}
}

export class UCWhileStatement extends UCThenStatement {

}

export class UCSwitchStatement extends UCThenStatement {

}

export class UCCaseClause extends UCThenStatement {
	public break?: IStatement;

	getContainedSymbolAtPos(position: Position) {
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

export class UCDefaultClause extends UCCaseClause {

}

export class UCForStatement extends UCThenStatement {
	// @super.expression is the conditional if expression
	public init?: IExpression;
	public next?: IExpression;

	getContainedSymbolAtPos(position: Position) {
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
		if (this.init) this.init.analyze(document, context);
		if (this.next) this.next.analyze(document, context);
	}
}

export class UCForEachStatement extends UCThenStatement {

}

export class UCLabeledStatement extends UCBaseStatement {
	label?: string;

	getContainedSymbolAtPos(_position: Position) {
		return undefined;
	}

	index(_document: UCDocument, _context: UCStructSymbol): void {
	}

	analyze(_document: UCDocument, _context: UCStructSymbol): void {
	}
}

export class UCReturnStatement extends UCExpressionStatement {

}

export class UCGotoStatement extends UCExpressionStatement {
	label?: string;
}