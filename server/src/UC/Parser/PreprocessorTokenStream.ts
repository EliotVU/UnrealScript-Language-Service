import { Token, type WritableToken } from 'antlr4ts';
import { UCLexer } from '../antlr/generated/UCLexer';
import { MacroState, UCPreprocessorParser, type MacroExpressionContext } from '../antlr/generated/UCPreprocessorParser';
import { MacroProvider } from './MacroProvider';
import { getCtxDebugInfo, getTokenDebugInfo } from './Parser.utils';
import { UCPreprocessorMacroTransformer } from './PreprocessorMacroTransformer';
import { UCTokenStream } from './TokenStream';

const PROCESSED_MACRO_CHANNEL = -1;

export class UCPreprocessorTokenStream extends UCTokenStream {
    readonly macroParser: UCPreprocessorParser;
    private macroTransformer: UCPreprocessorMacroTransformer;

    constructor(tokenSource: UCLexer, macroProvider: MacroProvider, macroState?: MacroState) {
        super(tokenSource, undefined);

        this.macroParser = new UCPreprocessorParser(this);
        this.macroParser.macroProvider = macroProvider;
        this.macroParser.macroState = macroState ?? new MacroState();

        if (process.env.NODE_ENV !== 'test') {
            this.macroParser.removeErrorListeners();
        }

        this.macroTransformer = new UCPreprocessorMacroTransformer(this, macroProvider);
    }

    private macroDepth = 0;

    private pendingTokens: Token[] = [];
    private pendingIndex = 0;

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

        while (true) {
            // If we are looking for a macro channel token, but hit another macro invoke character...
            // e.g. `mymacro in `if(`mymacro)
            while (token.channel !== channel || (token.type === UCLexer.MACRO_CHAR)) {
                if (token.type === Token.EOF) {
                    return i;
                }

                if (token.type !== Token.EOF &&
                    token.channel === UCLexer.DEFAULT_TOKEN_CHANNEL &&
                    this.macroParser.macroState.isActive() === false) {
                    // console.info('Skipping disabled token', getTokenDebugInfo(token));

                    // Also hide the token from the parser.
                    (<WritableToken>token).channel = UCLexer.MACRO_HIDDEN;

                    continue;
                }

                // Sanity check to ensure that it never starts processing the same macro more than once.
                // Can occurr unintentionally when the parser failed to predict the grammar. e.g. "local `boolType localBool;"
                // But is also expected to occur on the macro token that we are actively preprocessing.
                if (token.channel === PROCESSED_MACRO_CHANNEL) {
                    // We actually want to return this one! (but without preprocessing it)
                    if (channel === UCLexer.MACRO) {
                        return i;
                    }

                    this.sync(++i);
                    token = this.tokens[i];

                    continue;
                }

                // if (channel === UCLexer.MACRO && token.channel === UCLexer.DEFAULT_TOKEN_CHANNEL) {
                //     console.debug('return to default channel', getTokenDebugInfo(token, this.macroParser));
                //     this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;
                //     return i;
                // }

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
                    // Prevent this token from being preprocessed/expanded again.
                    (<WritableToken>token).channel = PROCESSED_MACRO_CHANNEL;
                    let macroCtx: MacroExpressionContext;
                    try {
                        macroCtx = this.macroParser.macroExpression();
                    } finally {
                        // Return to picking up default tokens.
                        this.channel = UCLexer.DEFAULT_TOKEN_CHANNEL;
                        this.macroDepth--;
                    }

                    const finalMacroToken = macroCtx.stop ?? this.macroParser.currentToken;
                    if (typeof finalMacroToken === 'undefined') {
                        console.error('Incomplete macro, expanding aborted');

                        continue;
                    }

                    if (process.env.NODE_ENV === 'test') {
                        console.debug(this.macroDepth,
                            '<LastToken>',
                            getTokenDebugInfo(finalMacroToken, this.macroParser)
                        );
                    }

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
                            // i = adjacentTokenIndex + 1;
                            // token = this.tokens[i];
                            this.sync(++i);
                            token = this.tokens[i];

                            console.debug('no transformation tokens, skipping to next token');

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

                            // Old approach, instead let 'fetch' do the index assignment.
                            // const nextTokenIndex = adjacentTokenIndex + j;
                            inlineToken.tokenIndex = -1;
                            // align with the macro char ` for proper error alignment.
                            inlineToken.line = token.line;
                            inlineToken.charPositionInLine = token.charPositionInLine;

                            // Macros inside of an `include file can be marked as PROCESSED due caching.
                            if (inlineToken.channel === PROCESSED_MACRO_CHANNEL) {
                                inlineToken.channel = UCLexer.MACRO;
                            }
                        }

                        this.pendingTokens.splice(this.pendingIndex, 0, ...inlineTokens);
                        this.fetchedEOF = false; // Parser may have fetched EOF before the expansion.

                        // this.tokens.splice(adjacentTokenIndex, 0, ...inlineTokens);
                        if (process.env.NODE_ENV === 'test') {
                            console.debug(inlineTokens
                                .map(t => `<<< ${getTokenDebugInfo(t, this.macroParser)}`)
                                .join(',\n' + this.macroDepth)
                            );
                        }

                        if (this.tokens.length - adjacentTokenIndex > 0) {
                            // FIXME: Prevent this overflow from happening! The macro parser's generated code tries to ensure there's always a next token for the macro channel
                            for (let k = adjacentTokenIndex; k < this.tokens.length; ++k) {
                                if (process.env.NODE_ENV === 'test') {
                                    console.debug(this.macroDepth,
                                        'shifting overflown token',
                                        getTokenDebugInfo(this.tokens[k]), 'new index', k
                                    );
                                }

                                // Old inlined approach, instead let this.fetch() do the index assignment.
                                // (<WritableToken>this.tokens[k]).tokenIndex = k;
                                (<WritableToken>this.tokens[k]).tokenIndex = -1;
                            }

                            this.pendingTokens.push(...this.tokens.splice(adjacentTokenIndex, this.tokens.length - adjacentTokenIndex));
                        }

                        if (this.macroDepth > 0) {
                            this.channel = channel;
                            // this.macroDepth = 0;
                            // this.p = i;
                            console.debug(this.macroDepth,
                                're-starting at initial token',
                                getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                            );

                            return i;
                        }

                        // Re-start at the first inlined token.
                        this.sync(++i);
                        token = this.tokens[i];

                        if (process.env.NODE_ENV === 'test') {
                            console.debug(this.macroDepth,
                                're-starting at inlined token',
                                getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                            );
                        }

                        continue;
                    }

                    // HACK: ensure that the parser can match any inlined macro char e.g. `macroName when expanded inside of an `if
                    // -- Otherwise it starts at the end of `macroName and will fail match against ')' while expecting a `
                    if (this.macroDepth > 0) {
                        this.channel = channel;
                        // this.macroDepth = 0;
                        // this.p = i;
                        console.debug(this.macroDepth,
                            '(no expansion) re-starting at initial token',
                            getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                        );

                        return i;
                    }

                    i = this.p;
                    token = this.tokens[i];

                    if (process.env.NODE_ENV === 'test') {
                        console.debug(this.macroDepth,
                            '(no expansion) re-starting at adjacent token',
                            getTokenDebugInfo(token, this.macroParser), 'on filtered channel', channel
                        );
                    }

                    continue;
                } catch (exc) {
                    const contextToken = this.macroParser.currentToken;

                    console.error('macro transformation parsing error on depth',
                        this.macroDepth, exc,
                        `\n\t\toccurred at token ${getTokenDebugInfo(contextToken, this.macroParser)}`,
                        this.macroTransformer.macroProvider.filePath
                    );

                    while (
                        this.tokens.length > this.p &&
                        this.tokens[this.p++].channel === UCLexer.MACRO
                    );

                    if (i === this.p) {
                        throw exc;
                    }

                    if (process.env.NODE_ENV === 'development') {
                        console.warn('Re-starting at token', getTokenDebugInfo(this.tokens[this.p]));
                    }

                    i = this.p;
                }
            }

            if (token.channel === UCLexer.DEFAULT_TOKEN_CHANNEL &&
                this.macroParser.macroState.isActive() === false) {

                if (token.type === Token.EOF) {
                    break;
                }

                // console.info('Skipping disabled token', getTokenDebugInfo(token));

                // Also hide the token from the parser.
                (<WritableToken>token).channel = UCLexer.MACRO_HIDDEN;

                this.sync(++i);
                token = this.tokens[i];

                continue;
            }

            break;
        }

        return i;
    }

    override sync(i: number): boolean {
        if (this.pendingTokens.length === 0) {
            return super.sync(i);
        }

        return this.fetch(1) > 0;
    }

    override fetch(n: number) {
        if (this.fetchedEOF) {
            return 0;
        }

        for (let i = 0; i < n; i++) {
            let token: WritableToken;

            if (this.pendingTokens.length === 0) {
                token = <WritableToken>this.tokenSource.nextToken();
            } else {
                token = <WritableToken>this.pendingTokens.splice(this.pendingIndex, 1)[0];
            }

            if (token.tokenIndex === -1) {
                token.tokenIndex = this.tokens.length;

                // console.info('fetched token', getTokenDebugInfo(token));
                // // Hide all the default tokens if we are within a 'disabled' block (i.e. within a `if and `endif block)
                // if (token.type !== Token.EOF &&
                //     token.channel === UCLexer.DEFAULT_TOKEN_CHANNEL &&
                //     this.macroParser.isActive() === false) {
                //     console.info('Hiding token', getTokenDebugInfo(token));

                //     token.channel = UCLexer.MACRO_HIDDEN;
                // }
            }

            this.tokens.push(token);

            if (token.type === Token.EOF) {
                this.fetchedEOF = true;

                // console.debug('EOF token', getTokenDebugInfo(token));

                return i + 1;
            }
        }

        return n;
    }
}
