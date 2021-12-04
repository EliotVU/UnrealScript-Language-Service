/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-spread */
import { Position, Range } from 'vscode-languageserver';

import { UCDocument } from './document';
import { IExpression } from './expressions';
import { intersectsWith } from './helpers';
import {
    IContextInfo, Identifier, ISymbol, UCObjectSymbol, UCStructSymbol, UCTypeFlags
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IStatement {
	getRange(): Range;
	getSymbolAtPos(position: Position): ISymbol | undefined;

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo): void;
	accept<Result>(visitor: SymbolWalker<Result>): Result;
}

export class UCExpressionStatement implements IStatement {
	expression?: IExpression;

	constructor(protected range: Range) {

	}

	getRange(): Range {
		return this.range;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getContainedSymbolAtPos(position: Position): ISymbol | undefined {
		return this.expression?.getSymbolAtPos(position);
	}

	index(_document: UCDocument, _context: UCStructSymbol, _info?: IContextInfo) {
		this.expression?.index.apply(this.expression, arguments);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitExpressionStatement(this);
	}
}

export abstract class UCThenStatement extends UCExpressionStatement {
	public then?: IStatement;

	getContainedSymbolAtPos(position: Position) {
		return super.getContainedSymbolAtPos(position) || this.then?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		super.index(document, context, info);
		this.then?.index(document, context, info);
	}
}

export class UCBlock implements IStatement {
	statements!: Array<IStatement | undefined>;

	constructor(protected range: Range) {

	}

	getRange(): Range {
		return this.range;
	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getContainedSymbolAtPos(position: Position) {
		for (const statement of this.statements) if (statement) {
			const symbol = statement.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(_document: UCDocument, _context: UCStructSymbol, info: IContextInfo = {}) {
		const typeFlags = info.typeFlags;
		for (const statement of this.statements) if (statement) {
			if (statement instanceof UCObjectSymbol) {
				continue;
			}
			statement.index.apply(statement, arguments);
			info.typeFlags = typeFlags; // Reset any modification (during the last index() call) made to typeFlags
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitBlock(this);
	}
}

export class UCAssertStatement extends UCExpressionStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitAssertStatement(this);
	}
}

export class UCIfStatement extends UCThenStatement {
	public else?: IStatement;

	getContainedSymbolAtPos(position: Position) {
		return super.getContainedSymbolAtPos(position) || this.else?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		super.index(document, context, info);
		this.else?.index(document, context, info);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitIfStatement(this);
	}
}

export class UCDoUntilStatement extends UCThenStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDoUntilStatement(this);
	}
}

export class UCWhileStatement extends UCThenStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitWhileStatement(this);
	}
}

export class UCSwitchStatement extends UCThenStatement {
	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		if (this.expression) {
			this.expression.index(document, context, info);
			// TODO: validate all legal switch types!
			// Also, cannot switch on static arrays.
			const type = this.expression.getType();
			if (type) {
				// Our case-statements need to know the type that our switch is working with.
				info = { typeFlags: type.getTypeFlags() };
			}
		}
		this.then?.index(document, context, info);
		// super.index(document, context, info);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitSwitchStatement(this);
	}
}

export class UCCaseClause extends UCThenStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitCaseClause(this);
	}
}

export class UCDefaultClause extends UCThenStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitDefaultClause(this);
	}
}

export class UCForStatement extends UCThenStatement {
	// @super.expression is the conditional if expression
	public init?: IExpression;
	public next?: IExpression;

	getContainedSymbolAtPos(position: Position) {
		return super.getContainedSymbolAtPos(position)
			|| this.init?.getSymbolAtPos(position)
			|| this.next?.getSymbolAtPos(position);
	}

	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		super.index(document, context, info);
		this.init?.index(document, context, info);
		this.next?.index(document, context, info);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitForStatement(this);
	}
}

export class UCForEachStatement extends UCThenStatement {
	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitForEachStatement(this);
	}
}

export class UCLabeledStatement implements IStatement {
	label?: Identifier;

	constructor(protected range: Range) {

	}

	getRange(): Range {
		return this.range;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		return undefined;
	}

	getContainedSymbolAtPos(position: Position): ISymbol | undefined {
		return undefined;
	}

	index(_document: UCDocument, _context: UCStructSymbol, _info?: IContextInfo) {
        //
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitLabeledStatement(this);
	}
}

export class UCReturnStatement extends UCExpressionStatement {
	index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
		const type = context.getType();
		if (type) {
			info = { typeFlags: type.getTypeFlags() };
		}
		super.index(document, context, info);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitReturnStatement(this);
	}
}

export class UCGotoStatement extends UCExpressionStatement {
    index(document: UCDocument, context: UCStructSymbol, info?: IContextInfo) {
        super.index(document, context, { typeFlags: UCTypeFlags.Name });
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitGotoStatement(this);
	}
}