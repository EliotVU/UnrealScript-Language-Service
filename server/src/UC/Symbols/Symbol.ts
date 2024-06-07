import { Token } from 'antlr4ts';
import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { Name } from '../name';
import { NAME_NONE } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextInfo,
    getSymbolPathHash,
    Identifier,
    isOperator,
    ISymbol,
    IWithInnerSymbols,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';

export const DEFAULT_POSITION = Position.create(0, 0);
export const DEFAULT_RANGE = Range.create(DEFAULT_POSITION, DEFAULT_POSITION);
export const DEFAULT_IDENTIFIER: Identifier = {
    name: NAME_NONE,
    range: DEFAULT_RANGE
};

export const enum ContextKind {
    None,
    DOT,
}

/**
 * A symbol built from an AST context.
 */
export abstract class UCObjectSymbol implements ISymbol, IWithInnerSymbols {
    readonly kind: UCSymbolKind = UCSymbolKind.None;

    public outer?: UCObjectSymbol = undefined;
    public nextInHash?: UCObjectSymbol | undefined = undefined;

    public description?: Token | Token[] = undefined;

    // TODO: Clarify id
    constructor(
        readonly id: Identifier, 
        readonly range: Range) {

    }

    getName(): Name {
        return this.id.name;
    }

    // Particular use case to index symbol references by outer.
    getHash(): number {
        return getSymbolPathHash(this);
    }

    getPath(): string {
        const names: string[] = [this.id.name.text];
        for (let outer = this.outer; outer; outer = outer.outer) {
            names.unshift(outer.id.name.text);
        }
        return names.join('.');
    }

    getTypeKind() {
        return UCTypeKind.Error;
    }

    // TODO: Move to visitor pattern
    /** Returns a tooltip for this symbol, usually mirroring the written code, but minimalized and formatted. */
    getTooltip(): string {
        return this.getPath();
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        return UCObjectSymbol.getSymbolAtPos(this, position);
    }

    static getSymbolAtPos(symbol: UCObjectSymbol, position: Position): ISymbol | undefined {
        if (intersectsWith(symbol.range, position)) {
            if (intersectsWithRange(position, symbol.id.range)) {
                return symbol;
            }
    
            const innerSymbol = symbol.getContainedSymbolAtPos(position);
            if (typeof innerSymbol === 'undefined' && intersectsWithRange(position, symbol.id.range)) {
                return symbol;
            }
    
            return innerSymbol;
        }
        
        return undefined;
    }

    // TODO: Move to visitor pattern
    getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
        return undefined;
    }

    // TODO: Refactor ISymbol to CompletionItem.
    getCompletionSymbols<C extends ISymbol>(_document: UCDocument, _context: ContextKind, _kinds?: UCSymbolKind): C[] {
        return [];
    }

    // TODO: Move to visitor pattern
    acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
        if (isOperator(this)) {
            return false;
        }

        return true;
    }

    index(_document: UCDocument, _context: UCStructSymbol, _info?: ContextInfo) {
        //
    }

    // TODO: Move to visitor pattern
    getDocumentation(): Token | Token[] | undefined {
        return this.description;
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visit(this);
    }

    toString(): string {
        return this.getPath();
    }
}

export class UCEmptySymbol extends UCObjectSymbol {
    override accept<Result>(visitor: SymbolWalker<Result>): void | Result {
        return;
    }
}
