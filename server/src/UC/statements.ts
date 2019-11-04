import { Position, Range } from 'vscode-languageserver';

import { intersectsWith } from './helpers';
import { UCDocument } from './document';

import { UCStructSymbol, ISymbol, IContextInfo, UCTypeFlags } from './Symbols';
import { IExpression, analyzeExpressionType } from './expressions';
import { SymbolWalker } from './symbolWalker';
import { Name } from './names';
import { config } from './indexer';

export interface IStatement {
	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo): void;
	accept<Result>(visitor: SymbolWalker<Result>): Result;
}

export class UCExpressionStatement implements IStatement {
	expression?: IExpression;

	constructor(protected range: Range) {

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

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitStatement(this);
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
}

export class UCBlock implements IStatement {
	statements: Array<IStatement | undefined>;

	constructor(protected range: Range) {

	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getContainedSymbolAtPos(position: Position) {
		for (let statement of this.statements) if (statement) {
			const symbol = statement.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		for (let statement of this.statements) if (statement) {
			statement.index.apply(statement, arguments);
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitBlock(this);
	}
}

export class UCAssertStatement extends UCExpressionStatement {
	// analyze(document: UCDocument, context: UCStructSymbol) {
	// 	if (this.expression && config.checkTypes) {
	// 		const err = analyzeExpressionType(this.expression, UCTypeFlags.Bool);
	// 		if (err) document.nodes.push(err);
	// 	}
	// }
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
}

export class UCDoUntilStatement extends UCThenStatement {
}

export class UCWhileStatement extends UCThenStatement {
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
}

export class UCCaseClause extends UCThenStatement {

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
}

export class UCForEachStatement extends UCThenStatement {

}

export class UCLabeledStatement extends UCExpressionStatement {
	label?: Name;
}

export class UCReturnStatement extends UCExpressionStatement {

}

export class UCGotoStatement extends UCExpressionStatement {
}