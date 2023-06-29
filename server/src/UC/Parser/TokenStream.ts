import { ANTLRErrorListener, CommonTokenStream, Token, WritableToken } from 'antlr4ts';

import { UCLexer } from '../antlr/generated/UCLexer';
import { MacroCallContext, MacroProgramContext } from '../antlr/generated/UCPreprocessorParser';
import { UCInputStream } from './InputStream';

const DEFAULT_INPUT = UCInputStream.fromString(''); 

export class UCTokenStream extends CommonTokenStream {
    readonly evaluatedTokens = new Map<number, WritableToken[]>();

    initMacroTree(macroTree: MacroProgramContext, errListener?: ANTLRErrorListener<number>) {
        const smNodes = macroTree.macroStatement();
        if (smNodes) {
            const rawLexer = new UCLexer(DEFAULT_INPUT);
            if (errListener) {
                rawLexer.removeErrorListeners(); rawLexer.addErrorListener(errListener);
            }

            for (const smNode of smNodes) {
                const macroCtx = smNode.macro();
                if (macroCtx.isActive && macroCtx instanceof MacroCallContext) {
                    // TODO: Cache the evaluated tokens from within the `define context itself,
                    // -- so that we don't have to repeat this step for each macro call.
                    let tokens = macroCtx.evaluatedTokens;
                    if (!tokens) {
                        const value = macroCtx._expr.value.toString();
                        if (value === '...') {
                            // stumbled on an empty definition.
                            continue;
                        }
                        const rawText = value.replace('\\', '');
                        const inputStream = UCInputStream.fromString(rawText);
                        rawLexer.inputStream = inputStream;
                        tokens = rawLexer.getAllTokens();
                        macroCtx.evaluatedTokens = tokens;
                    }

                    if (tokens) {
                        const token = smNode.MACRO_CHAR();
                        this.evaluatedTokens.set(token.symbol.startIndex, tokens as WritableToken[]);
                    }
                }
            }
        }
    }

    override fetch(n: number) {
        if (this.fetchedEOF) {
            return 0;
        }
        for (let i = 0; i < n; i++) {
            const token = this.tokenSource.nextToken() as WritableToken;

            // See if we have any evaluated tokens for this macro call.
            // if so, insert a token references to the evaluated tokens that are part of a "`define" text block.
            if (token.type === UCLexer.MACRO_CHAR) {
                const macroTokens = this.evaluatedTokens.get(token.startIndex);
                if (macroTokens) {
                    const baseline = macroTokens[0].line;
                    const basechar = macroTokens[0].charPositionInLine;
                    for (let j = 0; j < macroTokens.length; ++j) {
                        const macroToken = macroTokens[j];
                        macroToken.tokenIndex = i + j;
                        macroToken.line = token.line + (macroToken.line - baseline);
                        macroToken.charPositionInLine = token.charPositionInLine;//token.charPositionInLine + (macroToken.charPositionInLine - basechar);
                    }
                    this.tokens.push(...macroTokens);
                    n += macroTokens.length;
                }
            }

            token.tokenIndex = this.tokens.length;
            this.tokens.push(token);

            if (token.type === Token.EOF) {
                this.fetchedEOF = true;
                return i + 1;
            }
        }
        return n;
    }

    public fetchHeaderComment(token: Token): Token | Token[] | undefined {
        let comments: Token[] | undefined;

        let precedingLine = token.line - 1;
        const pos = token.charPositionInLine;
        let i = token.tokenIndex;
        for (; --i >= 0;) {
            token = this.get(i);
            // Stop at the first /* */ comment 
            // only if we are not actively looking for preceding // comments
            // note that a block comment may span several lines!
            if (token.type === UCLexer.BLOCK_COMMENT
                && typeof comments === 'undefined'
                && token.charPositionInLine === pos) {
                return token;
            }

            if (token.line < precedingLine) {
                break;
            }

            if (token.channel === UCLexer.COMMENTS_CHANNEL) {
                // Let's not pickup comments that start after trailing spaces, or after a preceding declaration.
                if (token.charPositionInLine !== pos) {
                    break;
                }

                if (comments === undefined) {
                    comments = [];
                }
                comments.push(token);

                // Look for more comments starting with '//' directly the last comment.
                --precedingLine;
                continue;
            }
        }

        return comments;
    }

    public fetchLeadingComment(token: Token): Token | undefined {
        let i = token.tokenIndex;
        const leadingLine = token.line;
        do {
            this.sync(++i);
            if (i >= this.tokens.length)
                break;
            token = this.tokens[i];
        } while (token.channel !== UCLexer.COMMENTS_CHANNEL && token.line === leadingLine);

        return token;
    }
}

export function commentTokensToStrings(comment: Token | Token[]): string[] {
    function stripLine(line: string): string {
        if (line.startsWith('//')) {
            return line.substring(2).trimStart();
        }

        return line;
    }

    if (Array.isArray(comment)) {
        return comment
            .map(token => stripLine(token.text!))
            .reverse();
    }

    // Simple stripping of a /* comment */ block
    const commentStr = comment.text!;
    if (commentStr.startsWith('/*')) {
        // Safe to assume that we are working with a string that ends with */
        const stripped = commentStr.startsWith('/**')
            ? commentStr.substring(3, commentStr.length - 2)
            : commentStr.substring(2, commentStr.length - 2);

        return stripped
            .split('\n')
            // Strip the leading indention
            .map(line => line.trimStart())
            .map(line => {
                if (line.startsWith('*')) {
                    return line.substring(1);
                }

                return line;
            })
            .filter(line => line.length > 0);
    }

    return [stripLine(commentStr)];
}
