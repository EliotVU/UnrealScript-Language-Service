import { Position, Range } from 'vscode-languageserver';
import { ParserRuleContext } from 'antlr4ts/ParserRuleContext';

import { intersectsWith, rangeFromBounds } from './helpers';
import { UCDocument } from './document';

import { UCStructSymbol, ISymbol, IContextInfo, UCTypeFlags } from './Symbols';
import { IExpression, analyzeExpressionType } from './expressions';
import { config } from './indexer';

export interface IStatement {
	context?: ParserRuleContext;

	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo): void;
	analyze(document: UCDocument, context: UCStructSymbol): void;
}

export abstract class UCBaseStatement implements IStatement {
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
	context?: ParserRuleContext;
	expression?: IExpression;

	constructor(private range: Range) {

	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position): ISymbol | undefined {
		return this.expression && this.expression.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?) {
		if (this.expression) {
			this.expression.index.apply(this.expression, arguments);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol, info?) {
		if (this.expression) {
			this.expression.analyze.apply(this.expression, arguments);
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
			statement.index.apply(statement, arguments);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			statement.analyze.apply(statement, arguments);
		}
	}
}

export class UCAssertStatement extends UCExpressionStatement {
	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.expression && config.checkTypes) {
			const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
			if (err) document.nodes.push(err);
		}
	}
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
		if (this.expression && config.checkTypes) {
			const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
			if (err) document.nodes.push(err);
		}
		this.else && this.else.analyze(document, context);
	}
}

export class UCDoUntilStatement extends UCThenStatement {
	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.expression && config.checkTypes) {
			const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
			if (err) document.nodes.push(err);
		}
	}
}

export class UCWhileStatement extends UCThenStatement {
	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.expression && config.checkTypes) {
			const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
			if (err) document.nodes.push(err);
		}
	}
}

export class UCSwitchStatement extends UCExpressionStatement {
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

		const type = this.expression && this.expression.getTypeFlags();
		if (type) {
			// TODO: validate all legal switch types!
			// Also, cannot switch on static arrays.
		}

		if (this.then) {
			// Our case-statements need to know the type that our switch is working with.
			this.then.index(document, context, { type });
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.then && this.then.analyze(document, context);
	}
}

export class UCCaseClause extends UCExpressionStatement {
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

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		// We have to pass info for our "this.expression",
		// -- so that it can properly lookup an enum-member, if our parent 'switch' is applied on an enum.
		super.index(document, context, info);
		this.then && this.then.index(document, context);
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		this.then && this.then.analyze(document, context);
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
		if (this.expression && config.checkTypes) {
			const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
			if (err) document.nodes.push(err);
		}
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
}