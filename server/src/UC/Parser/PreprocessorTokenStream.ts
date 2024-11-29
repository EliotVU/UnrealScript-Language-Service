import { type WritableToken, Token } from 'antlr4ts';
import { UCLexer } from '../antlr/generated/UCLexer';
import { UCPreprocessorParser } from '../antlr/generated/UCPreprocessorParser';
import { MacroProvider } from './MacroProvider';
import { getCtxDebugInfo, getTokenDebugInfo } from './Parser.utils';
import { UCPreprocessorMacroTransformer } from './PreprocessorMacroTransformer';
import { UCTokenStream } from './TokenStream';

const PROCESSED_MACRO_CHANNEL = -1;

export class UCPreprocessorTokenStream extends UCTokenStream {
    readonly macroParser: UCPreprocessorParser;
    private macroTransformer: UCPreprocessorMacroTransformer;

    constructor(tokenSource: UCLexer, macroProvider: MacroProvider) {
        super(tokenSource, undefined);

        this.macroParser = new UCPreprocessorParser(this);
        this.macroParser.macroProvider = macroProvider;

        if (process.env.NODE_ENV !== 'test') {
            this.macroParser.removeErrorListeners();
        }

        this.macroTransformer = new UCPreprocessorMacroTransformer(this, macroProvider);
    }

    private macroDepth = 0;

    override tryLT(k: number): Token | undefined {
        this.lazyInit();

        if (k < 0) {
            return this.tryLB(-k);
        }

        let i = this.p;
        let n = 1;
        while (n < k) {
            const channel = this.channel;
            i = this.nextTokenOnChannel(i + 1, channel);
            if (this.tokens[i].channel !== channel) {
                console.debug('bad token', getTokenDebugInfo(this.tokens[i], this.macroParser));
                i = this.nextTokenOnChannel(i + 1, channel);
            }

            n++;
        }

        return this.tokens[i];
    }

    protected override nextTokenOnChannel(i: number, channel: number): number {
        this.sync(i);

        if (i >= this.size) {
            return this.size - 1;
        }

        let token = this.tokens[i];
        while (token.channel !== channel) {
            if (token.type === Token.EOF) {
                return i;
            }

            // Sanity check to ensure that it never starts processing the same macro more than once.
            // Can occurr when the parser failed to predict the grammar. e.g. "local `boolType localBool;"
            if (token.channel === PROCESSED_MACRO_CHANNEL) {
                // console.warn('Unexpected macro token');

                this.sync(++i);
                token = this.tokens[i];

                continue;
            }

            if (channel === UCLexer.MACRO && token.type === UCLexer.NEWLINE) {
                // Step back to the last preceded macro token.
                for (let j = i - 1; j >= 0; --j) {
                    if (this.tokens[j].channel === UCLexer.HIDDEN) {
                        // console.debug('backstepping scanning index on newline token', i, j);
                        // i = j;

                        continue;
                    }

                    if (this.channel !== channel) {
                        i = j;
                    }

                    break;
                }

                // console.debug('Aborting macro parsing due an unexpected NEWLINE',
                //     'finishing on last token',
                //     getTokenDebugInfo(this.tokens[i], this.macroParser),
                //     this.channel);

                if (this.tokens[i].type == UCLexer.EOF) {
                    this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;
                }

                return i;
            }

            // While parsing a macro statement, ensure to stop the loop at the first token of a DEFAULT_TOKEN_CHANNEL
            // if (channel === UCLexer.MACRO && token.channel === UCLexer.DEFAULT_TOKEN_CHANNEL) {
            //     if (process.env.NODE_ENV === 'test') {
            //         console.debug(this.macroDepth,
            //             'Non macro token detected, ending macro channel',
            //             getTokenDebugInfo(token, this.macroParser)
            //         );
            //     }

            //     // Step back to the last preceded hidden token.
            //     for (let j = i - 1; j >= 0; --j) {
            //         if (this.tokens[j].channel === UCLexer.HIDDEN) {
            //             console.debug('backstepping scanning index on default token', i, j);
            //             i = j;
            //         }

            //         if (j + 1 === i) {
            //             // this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;

            //             return i;
            //         }


            //         break;
            //     }

            //     // this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;

            //     return i;
            // }

            if (token.type !== UCLexer.MACRO_CHAR) {
                this.sync(++i);
                token = this.tokens[i];

                continue;
            }

            try {
                if (process.env.NODE_ENV === 'test') {
                    console.debug(this.macroDepth,
                        '<Preprocessing Macro>',
                        getTokenDebugInfo(token, this.macroParser)
                    );
                }

                this.macroDepth++;
                // p is sometimes pointing to a '\n' token where the previous processed macro may have aborted the parsing.
                // e.g. `include(this file ends on \n)\n`mymacro
                this.p = i;
                // Begin parsing and fetch all macro tokens until the first occurance of a DEFAULT_CHANNEL token.
                this.channel = UCLexer.MACRO;
                const macroCtx = this.macroParser.macroPrimaryExpression();
                this.macroDepth--;

                // Prevent this token from bein preprocessed twice.
                // ! FIXME: happens when inlined between default tokens e.g. "static \`macro function"
                (<WritableToken>token).channel = PROCESSED_MACRO_CHANNEL;
                this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;

                const finalMacroToken = macroCtx.stop ?? this.macroParser.currentToken;
                if (typeof finalMacroToken === 'undefined') {
                    console.error('Incomplete macro, expanding aborted');

                    continue;
                }

                // if (process.env.NODE_ENV === 'test') {
                //     console.debug(this.macroDepth,
                //         '<LastToken>',
                //         getTokenDebugInfo(finalMacroToken, this.macroParser)
                //     );
                // }

                if (process.env.NODE_ENV === 'test') {
                    console.debug(this.macroDepth,
                        'processing macro context',
                        getCtxDebugInfo(macroCtx),
                        Object.getPrototypeOf(macroCtx),
                        macroCtx.text,
                        macroCtx.toString(this.macroParser)
                    );
                }

                const macroTransformation = this.macroTransformer.visit(macroCtx);

                if (process.env.NODE_ENV === 'test') {
                    console.debug(this.macroDepth,
                        'processed macro context',
                        getCtxDebugInfo(macroCtx), macroCtx.ruleContext.text
                    );
                }

                const adjacentTokenIndex = finalMacroToken.channel === UCLexer.MACRO
                    ? finalMacroToken.tokenIndex + 1
                    : finalMacroToken.tokenIndex;
                const adjacentToken = this.tokens[adjacentTokenIndex];
                this.p = adjacentTokenIndex;

                if (process.env.NODE_ENV === 'test') {
                    console.debug(this.macroDepth,
                        'macro adjacent token', getTokenDebugInfo(adjacentToken)
                    );
                }

                if (macroTransformation?.tokens) {
                    if (macroTransformation.tokens.length === 0) {
                        i = adjacentTokenIndex + 1;
                        token = this.tokens[i];

                        continue;
                    }

                    // if (process.env.NODE_ENV === 'test') {
                    //     console.debug(this.macroDepth,
                    //         '<<< inlining expanded tokens from the macro context'
                    //     );
                    // }

                    const inlineTokens = macroTransformation.tokens;

                    // Merge the last token of the expansion `{macroPrefix}AdjacentToken -> macroPrefixAdjacentToken
                    if (inlineTokens.length !== 0 &&
                        (inlineTokens[inlineTokens.length - 1].type === adjacentToken.type
                            // Merge id + integer `{macroPrefix}1651651
                            || (inlineTokens[inlineTokens.length - 1].type === UCLexer.INTEGER_LITERAL && adjacentToken.type === UCLexer.ID)
                        )) {
                        (<WritableToken>inlineTokens[inlineTokens.length - 1] as any).text = inlineTokens[0].text + (<WritableToken>adjacentToken as any).text;
                        // Hide the appended token so that it won't be 'matched' by the parser.
                        (<WritableToken>adjacentToken as any).channel = UCLexer.HIDDEN;
                    }

                    for (let j = 0; j < inlineTokens.length; ++j) {
                        const inlineToken = inlineTokens[j];

                        const nextTokenIndex = adjacentTokenIndex + j;
                        inlineToken.tokenIndex = nextTokenIndex;
                        // align with the macro char ` for proper error alignment.
                        inlineToken.line = token.line;
                        inlineToken.charPositionInLine = token.charPositionInLine;

                        // Macros inside of an `include file can be marked as PROCESSED due caching.
                        if (inlineToken.channel === PROCESSED_MACRO_CHANNEL) {
                            inlineToken.channel = UCLexer.MACRO;
                        }
                    }

                    this.tokens.splice(adjacentTokenIndex, 0, ...inlineTokens);
                    if (process.env.NODE_ENV === 'test') {
                        console.debug(inlineTokens
                            .map(t => `<<< ${getTokenDebugInfo(t, this.macroParser)}`)
                            .join(',\n' + this.macroDepth)
                        );
                    }

                    // FIXME: Prevent this overflow from happening! The macro parser's generated code tries to ensure there's always a next token for the macro channel
                    for (let k = adjacentToken.tokenIndex; k < this.tokens.length; ++k) {
                        // if (process.env.NODE_ENV === 'test') {
                        //     console.debug(this.macroDepth,
                        //         'shifting overflown token',
                        //         getTokenDebugInfo(this.tokens[k]), 'new index', k
                        //     );
                        // }

                        (<WritableToken>this.tokens[k]).tokenIndex = k;
                    }

                    // Re-start at the first inlined token.
                    i = inlineTokens[0].tokenIndex;
                    token = this.tokens[i];

                    if (process.env.NODE_ENV === 'test') {
                        console.debug(this.macroDepth,
                            're-starting at post macro token',
                            getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                        );
                    }

                    continue;
                }

                i = adjacentToken.tokenIndex;
                token = adjacentToken;

                if (process.env.NODE_ENV === 'test') {
                    console.debug(this.macroDepth,
                        're-starting at (expanless) post macro token',
                        getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                    );
                }
            } catch (exc) {
                console.error(this.macroDepth,
                    'macro transformation parsing error', exc);

                throw exc;
            }
        }

        return i;
    }

    override fetch(n: number) {
        if (this.fetchedEOF) {
            return 0;
        }

        for (let i = 0; i < n; i++) {
            const token = <WritableToken>this.tokenSource.nextToken();
            if (token.tokenIndex === -1) {
                token.tokenIndex = this.tokens.length;
            }

            this.tokens.push(token);

            if (token.type === Token.EOF) {
                this.fetchedEOF = true;

                return i + 1;
            }
        }

        return n;
    }
}
