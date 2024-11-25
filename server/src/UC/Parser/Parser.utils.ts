import { Parser, ParserRuleContext, Token } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { Position } from 'vscode-languageserver-textdocument';
import { intersectsWith, rangeFromCtx } from '../helpers';
import type { ExternalToken } from './ExternalTokenFactory';

export function getTokenDebugInfo(
    token: Token | undefined,
    parser?: Parser
): string {
    if (typeof token === 'undefined') {
        return 'null';
    }

    const typeTree = parser
        ? parser.vocabulary.getSymbolicName(token.type)
        : token.type;

    if (typeof (token as ExternalToken).externalSource !== 'undefined') {
        const externalToken = (token as ExternalToken);
        return `[${token.tokenIndex}] ${JSON.stringify(token.text)} (${externalToken.externalSource}:${externalToken.externalLine}:${externalToken.externalColumn + 1}) [${token.channel}:${typeTree}]`;
    }

    return `[${token.tokenIndex}] (${token.line}:${token.charPositionInLine}) [${token.channel}:${typeTree}] ${JSON.stringify(token.text)}`;
}

export function getCtxDebugInfo(
    ctx: ParserRuleContext | undefined,
    parser?: Parser
): string {
    if (typeof ctx === 'undefined') {
        return 'null';
    }

    const typeTree = parser
        ? parser.ruleNames[ctx.ruleIndex]
        : ctx.ruleIndex;

    return `(${ctx.start.line}:${ctx.start.charPositionInLine}) [${typeTree}]`;
}

export function getPositionDebugInfo(
    position: Position
): string {
    return `(${position.line + 1}:${position.character + 1})`;
}

// Can be narrowed down to a `RuleContext`
export function getParentRuleByIndex(
    ctx: ParserRuleContext | undefined,
    ruleIndex: number
): ParserRuleContext | undefined {
    while (ctx && ctx.ruleIndex !== ruleIndex) {
        ctx = ctx.parent;
    }

    return ctx;
}

export function getParentRuleByType(
    ctx: ParseTree | undefined,
    type: any
): ParseTree | undefined {
    while (ctx && !(ctx instanceof type)) {
        ctx = ctx.parent;
    }

    return ctx;
}

export function getIntersectingContext(
    ctx: ParserRuleContext,
    position: Position
): ParserRuleContext | undefined {
    // FIXME: Intersect without any conversion
    if (!intersectsWith(rangeFromCtx(ctx), position)) {
        return undefined;
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

