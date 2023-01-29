import { Parser, ParserRuleContext, Token } from 'antlr4ts';

export function getTokenDebugInfo(token: Token | undefined, parser?: Parser): string {
    if (typeof token === 'undefined') {
        return 'null';
    }
    const typeTree = parser ? parser.vocabulary.getSymbolicName(token.type) : token.type;
    return `(${token.line}:${token.charPositionInLine}) [${typeTree}] ${JSON.stringify(token.text)}`;
}

export function getCtxDebugInfo(ctx: ParserRuleContext | undefined, parser?: Parser): string {
    if (typeof ctx === 'undefined') {
        return 'null';
    }
    const typeTree = parser ? parser.ruleNames[ctx.ruleIndex] : ctx.ruleIndex;
    return `(${ctx.start.line}:${ctx.start.charPositionInLine}) [${typeTree}]`;
}
