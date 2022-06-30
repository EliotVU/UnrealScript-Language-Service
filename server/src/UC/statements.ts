/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-spread */
import { Position, Range } from 'vscode-languageserver';

import { UCDocument } from './document';
import { IExpression } from './expressions';
import { intersectsWith } from './helpers';
import {
    ContextInfo, Identifier, INode, ISymbol, IWithIndex, IWithInnerSymbols, StaticNameType,
    UCArchetypeSymbol, UCNodeKind, UCObjectTypeSymbol, UCStructSymbol
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IStatement extends INode, IWithIndex, IWithInnerSymbols {
    getRange(): Range;
    getSymbolAtPos(position: Position): ISymbol | undefined;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo): void;
    accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export class UCExpressionStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

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

    index(_document: UCDocument, _context: UCStructSymbol, _info?: ContextInfo) {
        this.expression?.index.apply(this.expression, arguments);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitExpressionStatement(this);
    }
}

export abstract class UCThenStatement extends UCExpressionStatement {
    public then?: IStatement;

    getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position) ?? this.then?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.then?.index(document, context, info);
    }
}

export class UCBlock implements IStatement {
    readonly kind = UCNodeKind.Statement;

    statements: Array<IStatement | undefined>;

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

    index(_document: UCDocument, _context: UCStructSymbol, info: ContextInfo = {}) {
        const typeFlags = info.contextType;
        for (const statement of this.statements) if (statement) {
            try {
                statement.index.apply(statement, arguments);
            } catch (err) {
                console.error('(Index error) on statement', statement, err);
            } finally {
                info.contextType = typeFlags; // Reset any modification (during the last index() call) made to typeFlags
            }
        }
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitBlock(this);
    }
}

export class UCArchetypeBlockStatement extends UCBlock {
    public archetypeSymbol: UCArchetypeSymbol;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.archetypeSymbol.index(document, context);
        super.index(document, this.archetypeSymbol);
    }
}

export class UCAssertStatement extends UCExpressionStatement {
    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitAssertStatement(this);
    }
}

export class UCIfStatement extends UCThenStatement {
    declare then?: UCBlock;

    public else?: IStatement;

    getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position) ?? this.else?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.else?.index(document, context, info);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitIfStatement(this);
    }
}

export class UCRepIfStatement extends UCExpressionStatement {
    public symbolRefs: UCObjectTypeSymbol[] | undefined;

    getContainedSymbolAtPos(position: Position) {
        if (this.symbolRefs) for (const ref of this.symbolRefs) {
            const symbol = ref.getSymbolAtPos(position);
            if (symbol) {
                return symbol;
            }
        }
        return super.getContainedSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.symbolRefs) for (const ref of this.symbolRefs) {
            const symbol = context.findSuperSymbol(ref.getName());
            if (typeof symbol === 'undefined') {
                continue;
            }
            ref.setRef(symbol, document);
        }
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitRepIfStatement(this);
    }
}

export class UCDoUntilStatement extends UCThenStatement {
    declare then?: UCBlock;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDoUntilStatement(this);
    }
}

export class UCWhileStatement extends UCThenStatement {
    declare then?: UCBlock;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitWhileStatement(this);
    }
}

export class UCSwitchStatement extends UCThenStatement {
    declare then?: UCBlock;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        if (this.expression) {
            this.expression.index(document, context, info);
            // TODO: validate all legal switch types!
            // Also, cannot switch on static arrays.
            const type = this.expression.getType();
            // Our case-statements need to know the type that our switch is working with.
            info = { contextType: type };
        }
        this.then?.index(document, context, info);
        // super.index(document, context, info);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitSwitchStatement(this);
    }
}

export class UCCaseClause extends UCThenStatement {
    declare then?: UCBlock;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitCaseClause(this);
    }
}

export class UCDefaultClause extends UCThenStatement {
    declare then?: UCBlock;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDefaultClause(this);
    }
}

export class UCForStatement extends UCThenStatement {
    declare then?: UCBlock;

    // @super.expression is the conditional if expression
    public init?: IExpression;
    public next?: IExpression;

    getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position)
            ?? this.init?.getSymbolAtPos(position)
            ?? this.next?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.init?.index(document, context, info);
        this.next?.index(document, context, info);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitForStatement(this);
    }
}

export class UCForEachStatement extends UCThenStatement {
    declare then?: UCBlock;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitForEachStatement(this);
    }
}

export class UCLabeledStatement implements IStatement {
    kind = UCNodeKind.Statement;

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

    index(_document: UCDocument, _context: UCStructSymbol, _info?: ContextInfo) {
        //
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitLabeledStatement(this);
    }
}

export class UCReturnStatement extends UCExpressionStatement {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        const type = context.getType();
        super.index(document, context, { contextType: type });
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitReturnStatement(this);
    }
}

export class UCGotoStatement extends UCExpressionStatement {
    index(document: UCDocument, context: UCStructSymbol, _info?: ContextInfo) {
        super.index(document, context, { contextType: StaticNameType });
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitGotoStatement(this);
    }
}

// Temporary placeholder for basic statements that we don't analyze yet.
export class UCDummyStatement extends UCExpressionStatement {
    getSymbolAtPos(position: Position): ISymbol | undefined {
        return undefined;
    }

    getContainedSymbolAtPos(position: Position): ISymbol | undefined {
        return undefined;
    }

    index(_document: UCDocument, _context: UCStructSymbol, _info?: ContextInfo) {
        //
    }
}

export class UCEmptyStatement extends UCExpressionStatement {
    getSymbolAtPos(position: Position): ISymbol | undefined {
        return undefined;
    }

    getContainedSymbolAtPos(position: Position): ISymbol | undefined {
        return undefined;
    }

    index(_document: UCDocument, _context: UCStructSymbol, _info?: ContextInfo) {
        //
    }
}