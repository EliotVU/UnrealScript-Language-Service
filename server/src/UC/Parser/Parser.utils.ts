import { ParserRuleContext, Token } from 'antlr4ts';

export function getTokenDebugInfo(token?: Token): string {
    if (typeof token === 'undefined') {
        return '';
    }
    return `(${token.line}:${token.charPositionInLine}) "${token.text}"`;
}

export function getCtxDebugInfo(ctx?: ParserRuleContext): string {
    if (typeof ctx === 'undefined') {
        return '';
    }
    return `(${ctx.start.line}:${ctx.start.charPositionInLine}) "${ctx.text}"`;
}
