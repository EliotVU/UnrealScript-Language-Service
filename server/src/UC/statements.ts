/* eslint-disable prefer-rest-params */
/* eslint-disable prefer-spread */
import { Location, Position, Range } from 'vscode-languageserver';

import { UCDocument } from './document';
import { IExpression } from './expressions';
import { intersectsWith } from './helpers';
import {
    addHashedSymbol,
    ContextInfo, getContext, Identifier, INode, isArchetypeSymbol, ISymbol, IWithInnerSymbols, ObjectsTable, StaticNameType,
    UCArchetypeSymbol, UCClassSymbol, UCNodeKind, UCObjectTypeSymbol, UCStructSymbol,
    UCSymbolKind
} from './Symbols';
import { SymbolWalker } from './symbolWalker';
import { NAME_NONE } from './names';
import { config, indexReference } from './indexer';
import { UCGeneration } from './settings';

export interface IStatement extends INode, IWithInnerSymbols {
    getSymbolAtPos(position: Position): ISymbol | undefined;

    /**
     * The second indexing pass, should index the referenced symbols.
     *
     * TODO: Consider using visitor pattern to index.
     *
     * @param document the document of the statement.
     * @param context context to use for symbol lookups. e.g. a `UCStateSymbol` in state code.
     * @param info context info such as a type hint.
     */
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo): void;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export class UCExpressionStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

    expression?: IExpression;

    constructor(readonly range: Range) {

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

    override getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position) ?? this.then?.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.then?.index(document, context, info);
    }
}

export class UCBlock implements IStatement {
    readonly kind = UCNodeKind.Statement;

    statements: Array<IStatement | undefined>;

    constructor(readonly range: Range) {

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

        return undefined;
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

export class UCArchetypeBlockStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

    /** The generated symbol that is declared by this statement. */
    public archetypeSymbol: UCArchetypeSymbol;

    /** A block of statements. */
    public block?: UCBlock;

    constructor(readonly range: Range) {

    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        return intersectsWith(this.range, position)
            ? this.getContainedSymbolAtPos(position)
            : undefined;
    }

    getContainedSymbolAtPos(position: Position): ISymbol | undefined {
        return this.block?.getSymbolAtPos(position) ?? (intersectsWith(this.archetypeSymbol.id.range, position) ? this.archetypeSymbol : undefined);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo): void {
        // Index the archetype's super class
        this.archetypeSymbol.index(document, context);

        if (this.archetypeSymbol.id.name !== NAME_NONE) {
            // Find the override if no class is specified (extendsType)
            if (config.generation === UCGeneration.UC3
                && !this.archetypeSymbol.extendsType
                && !this.archetypeSymbol.super) {
                // expecting context to be the 'Defaults__ClassName' archetype, so let's use its 'super' which should be the class it was declared in.
                const archetypeOuterClass = context.super && getContext<UCClassSymbol>(context.super, UCSymbolKind.Class);
                if (archetypeOuterClass && isArchetypeSymbol(archetypeOuterClass.defaults)) {
                    // Unlike the UnrealScript compiler
                    // -- we cannot safely find the symbol by using the hash table
                    // -- because that is sensitive to the compilation order of classes.
                    for (let parent = archetypeOuterClass.super; parent; parent = parent.super) {
                        const overriddenArchetype = parent.defaults.getSymbol<UCArchetypeSymbol>(this.archetypeSymbol.id.name, UCSymbolKind.Archetype);
                        if (overriddenArchetype) {
                            this.archetypeSymbol.overriddenArchetype = overriddenArchetype;
                            this.archetypeSymbol.super = overriddenArchetype.super;

                            // Index a reference to the overriden archetype.
                            indexReference(overriddenArchetype, document, Location.create(document.uri, this.archetypeSymbol.id.range));
                            break;
                        }
                    }
                }
            }

            // Allow assignments to find this archetype (by identifier or an object literal)
            addHashedSymbol(this.archetypeSymbol);
        }

        // Index the block's code in the context of the archetype symbol
        this.block?.index(document, this.archetypeSymbol, info);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArchetypeBlockStatement(this);
    }
}

export class UCAssertStatement extends UCExpressionStatement {
    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitAssertStatement(this);
    }
}

export class UCIfStatement extends UCThenStatement {
    declare then?: UCBlock;

    public else?: IStatement;

    override getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position) ?? this.else?.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.else?.index(document, context, info);
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitIfStatement(this);
    }
}

export class UCRepIfStatement extends UCExpressionStatement {
    public symbolRefs: UCObjectTypeSymbol[] | undefined;

    override getContainedSymbolAtPos(position: Position) {
        if (this.symbolRefs) for (const ref of this.symbolRefs) {
            const symbol = ref.getSymbolAtPos(position);
            if (symbol) {
                return symbol;
            }
        }
        return super.getContainedSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.symbolRefs) for (const ref of this.symbolRefs) {
            const symbol = context.findSuperSymbol(ref.getName());
            if (typeof symbol === 'undefined') {
                continue;
            }
            ref.setRef(symbol, document);
        }
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitRepIfStatement(this);
    }
}

export class UCDoUntilStatement extends UCThenStatement {
    declare then?: UCBlock;

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDoUntilStatement(this);
    }
}

export class UCWhileStatement extends UCThenStatement {
    declare then?: UCBlock;

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitWhileStatement(this);
    }
}

export class UCSwitchStatement extends UCThenStatement {
    declare then?: UCBlock;

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitSwitchStatement(this);
    }
}

export class UCCaseClause extends UCThenStatement {
    declare then?: UCBlock;

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitCaseClause(this);
    }
}

export class UCDefaultClause extends UCThenStatement {
    declare then?: UCBlock;

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDefaultClause(this);
    }
}

export class UCForStatement extends UCThenStatement {
    declare then?: UCBlock;

    // @super.expression is the conditional if expression
    public init?: IExpression;
    public next?: IExpression;

    override getContainedSymbolAtPos(position: Position) {
        return super.getContainedSymbolAtPos(position)
            ?? this.init?.getSymbolAtPos(position)
            ?? this.next?.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        this.init?.index(document, context, info);
        this.next?.index(document, context, info);
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitForStatement(this);
    }
}

export class UCForEachStatement extends UCThenStatement {
    declare then?: UCBlock;

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitForEachStatement(this);
    }
}

export class UCLabeledStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

    label?: Identifier;

    constructor(readonly range: Range) {

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
    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        const type = context.getType();
        super.index(document, context, { contextType: type });
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitReturnStatement(this);
    }
}

export class UCGotoStatement extends UCExpressionStatement {
    override index(document: UCDocument, context: UCStructSymbol, _info?: ContextInfo) {
        super.index(document, context, { contextType: StaticNameType });
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitGotoStatement(this);
    }
}

// Temporary placeholder for basic statements that we don't analyze yet.
export class UCControlStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

    constructor(readonly range: Range) {

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
        return visitor.visitStatement(this);
    }
}

export class UCEmptyStatement implements IStatement {
    readonly kind = UCNodeKind.Statement;

    constructor(readonly range: Range) {

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
        return visitor.visitStatement(this);
    }
}
