import { ParseTree, Parser, ParserRuleContext, Token } from 'antlr4ng';
import { Position } from 'vscode-languageserver-textdocument';
import { intersectsWith, rangeFromCtx } from '../helpers';

// Positions are transformed to match the visual representation of a line and column,
// -- that is to say that lines and columns start at 1.

export function getTokenDebugInfo(token: Token | null, parser?: Parser): string {
    if (token === null) {
        return 'null';
    }
    const typeTree = parser ? parser.vocabulary.getSymbolicName(token.type) : token.type;
    return `(${token.line}:${token.column + 1}) [${typeTree}] ${JSON.stringify(token.text)}`;
}

export function getCtxDebugInfo(ctx: ParserRuleContext | null, parser?: Parser): string {
    if (ctx === null) {
        return 'null';
    }
    const typeTree = parser ? parser.ruleNames[ctx.ruleIndex] : ctx.ruleIndex;
    return `(${ctx.start!.line}:${ctx.start!.column + 1}) [${typeTree}]`;
}

export function getPositionDebugInfo(position: Position): string {
    return `(${position.line + 1}:${position.character + 1})`;
}

// Can be narrowed down to a `RuleContext`
export function getParentRuleByIndex(
    ctx: ParserRuleContext | null,
    ruleIndex: number
): ParserRuleContext | null {
    while (ctx && ctx.ruleIndex !== ruleIndex) {
        ctx = ctx.parent;
    }

    return ctx;
}

export function getParentRuleByType(
    ctx: ParseTree | null,
    type: any
): ParseTree | null {
    while (ctx && !(ctx instanceof type)) {
        ctx = ctx.parent;
    }

    return ctx;
}

export function getIntersectingContext(
    ctx: ParserRuleContext,
    position: Position
): ParserRuleContext | null {
    // FIXME: Intersect without any conversion
    if (!intersectsWith(rangeFromCtx(ctx), position)) {
        return null;
    }

    // TODO: Perhaps binary search? Let's benchmark first to see if it matters at all.
    if (ctx.children) for (const child of ctx.children) {
        if (child instanceof ParserRuleContext) {
            const ctx = getIntersectingContext(child, position);
            if (ctx) {
                return ctx;
            }
        }
    }

    return ctx;
}

