import { AbstractParseTreeVisitor } from "antlr4ts/tree/AbstractParseTreeVisitor";
import type { ErrorNode } from "antlr4ts/tree/ErrorNode";
import { URI } from "vscode-uri";
import { pathExistsByURI, readTextByURI } from "../../workspace";
import { UCLexer } from "../antlr/generated/UCLexer";
import {
    MacroArgumentContext,
    MacroEmptyArgumentContext,
    type MacroDefineContext,
    type MacroElseIfContext,
    type MacroExpressionContext,
    type MacroIfContext,
    type MacroIncludeContext,
    type MacroInvocationContext,
    type MacroIsDefinedContext,
    type MacroIsNotDefinedContext,
    type MacroPrimaryExpressionContext,
    type MacroSecondaryExpressionContext,
    type MacroUndefineContext,
} from "../antlr/generated/UCPreprocessorParser";
import type { UCPreprocessorParserVisitor } from "../antlr/generated/UCPreprocessorParserVisitor";
import { getDocumentByURI, resolveIncludeFilePath } from "../indexer";
import type { ExternalToken } from "./ExternalTokenFactory";
import type { MacroProvider } from "./MacroProvider";
import { textToTokens } from "./preprocessor";
import { type UCPreprocessorTokenStream } from "./PreprocessorTokenStream";
import { getCtxDebugInfo } from './Parser.utils';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';

export type MacroTransformation = {
    /**
     * Expanded tokens; may include other macro tokens that need expansion.
     *
     * The tokens preserve the line and position from the origin source.
     **/
    tokens: ExternalToken[];
};

export class UCPreprocessorMacroTransformer
    extends AbstractParseTreeVisitor<MacroTransformation | undefined>
    implements UCPreprocessorParserVisitor<MacroTransformation | undefined> {

    readonly evaluatedTokens = new Map<number, ExternalToken[]>();

    constructor(
        readonly tokenStream: UCPreprocessorTokenStream,
        readonly macroProvider: MacroProvider) {
        super();
    }

    protected defaultResult(): undefined {
        return undefined;
    }

    override visitErrorNode(node: ErrorNode): MacroTransformation | undefined {
        console.error('Preprocessing error visit', node.text);

        return undefined;
    }

    visitMacroIf(ctx: MacroIfContext): MacroTransformation | undefined {
        return undefined;
    }

    visitMacroElseIf(ctx: MacroElseIfContext): MacroTransformation | undefined {
        return undefined;
    }

    visitMacroInclude(ctx: MacroIncludeContext): MacroTransformation | undefined {
        if (!ctx.isActive) {
            return undefined;
        }

        const includeFilePathArgument = ctx._arg.text;
        if (!includeFilePathArgument) {
            return undefined;
        }

        const includeFilePath = resolveIncludeFilePath(this.macroProvider.filePath, includeFilePathArgument);
        const includeFileUri = URI.file(includeFilePath).toString();

        if (!pathExistsByURI(includeFileUri)) {
            console.error(`Cannot include document "${includeFilePath}" because it does not exist.`);

            return undefined;
        }

        // ! this ensures that the file is part of the current workspace (non workspace files should have no document)
        const includeDocument = getDocumentByURI(includeFileUri);
        if (!includeDocument) {
            console.error(`Cannot include document "${includeFileUri}" because it missing from the workspace.`);

            return undefined;
        }

        if (includeDocument.tokensCache) {
            if (process.env.NODE_ENV === 'test') {
                console.info(`Re-using tokens from cached document "${includeFileUri}".`);
            }

            return { tokens: includeDocument.tokensCache };
        }

        console.info(`Lexing include document "${includeDocument.fileName}"`)

        const includeText = readTextByURI(includeFileUri);
        const tokens = textToTokens(includeText, undefined, includeFileUri);

        includeDocument.tokensCache = tokens;

        return {
            tokens,
        };
    }

    visitMacroDefine(ctx: MacroDefineContext): MacroTransformation | undefined {
        return undefined;
    }

    visitMacroUndefine(ctx: MacroUndefineContext): MacroTransformation | undefined {
        return undefined;
    }

    visitMacroIsDefined(ctx: MacroIsDefinedContext): MacroTransformation | undefined {
        // Should transform `isdefined(symbol) to '1' or ''
        if (ctx.value === '1') {
            const token = <ExternalToken>this.tokenStream
                .tokenSource.tokenFactory.createSimple(
                    UCLexer.INTEGER_LITERAL, '1',
                );

            token.line = ctx.start.line;
            token.externalLine = ctx.start.line;

            return {
                tokens: [token]
            };
        }

        return undefined;
    }

    visitMacroIsNotDefined(ctx: MacroIsNotDefinedContext): MacroTransformation | undefined {
        // Should transform `notdefined(symbol) to '1' or ''
        if (ctx.value === '1') {
            const token = <ExternalToken>this.tokenStream
                .tokenSource.tokenFactory.createSimple(
                    UCLexer.INTEGER_LITERAL, '1',
                );

            token.line = ctx.start.line;
            token.externalLine = ctx.start.line;

            return {
                tokens: [token]
            };
        }

        return undefined;
    }

    visitMacroExpression(ctx: MacroExpressionContext): MacroTransformation | undefined {
        return ctx._expr.accept(this);
    }

    visitMacroPrimaryExpression(ctx: MacroPrimaryExpressionContext): MacroTransformation | undefined {
        return ctx._macroInvocation ? ctx._macroInvocation.accept(this) : ctx._macroSecondaryExpression.accept(this);
    }

    visitMacroSecondaryExpression(ctx: MacroSecondaryExpressionContext): MacroTransformation | undefined {
        throw new Error("Invalid visit");
    }

    visitMacroInvocation(ctx: MacroInvocationContext): MacroTransformation | undefined {
        let definedText: string | undefined;

        const macroSymbol = ctx._MACRO_SYMBOL;
        // `if(`isdefined(macro))? (no macro symbol for `if)
        if (typeof macroSymbol === 'undefined') {
            return undefined;

            // undesired, outputs the `isdefined result after the `if close parenthesis.
            // return ctx._macroStatement.accept(this);
        }

        const macroName = macroSymbol.text!;

        // case-sensitive!
        switch (macroName) {
            case '__LINE__':
                return this.visitMacroSymbolLine(ctx);

            case '__FILE__':
                return this.visitMacroSymbolFile(ctx);
        }

        const symbolValue = this.macroProvider.getSymbol(macroName.toLowerCase());

        if (typeof symbolValue === 'undefined') {
            console.error(`Unknown macro '${macroName}'`, getCtxDebugInfo(ctx));

            return undefined;
        }

        definedText = symbolValue?.text;
        if (typeof definedText === 'undefined') {
            return undefined;
        }

        // FIXME: Terrible approach, but it does the job for now :)
        // TODO: Cannot replace `{param1}
        if (typeof symbolValue.params !== 'undefined') {
            const args = ctx._args;
            for (let i = 0, j = 0; i < symbolValue.params.length; ++i) {
                if (args && j < args.childCount) {
                    // Skip past any ','
                    if (args.children![j] instanceof TerminalNode) {
                        ++j;
                    }

                    if (args.children![j] instanceof MacroArgumentContext) {
                        const argText = args.children![j].text;
                        definedText = definedText.replaceAll(new RegExp(`\`${symbolValue.params[i]}`, 'gi'), argText);
                    } else if (args.children![j] instanceof MacroEmptyArgumentContext) {
                        // FIXME: What should happen to params with an undefined argument?
                        // consider this: "`define log(msg,cond,tag) `if(`cond) if(`cond) `endif Log(msg, tag)"
                        // definedText = definedText.replaceAll(new RegExp(`\`${symbolValue.params[i]}`, 'gi'), '0');
                    }
                    ++j;
                } else {
                    // empty arg
                    // Do nothing, the macro parameter should not expand to anything
                    // definedText = definedText.replaceAll(new RegExp(`\`${symbolValue.params[i]}`, 'gi'), '0');
                }
            }

            definedText = definedText.replaceAll(new RegExp(`\`\#`, 'gi'), symbolValue.params.length.toString());
        }

        // Remove the trailing new line '\'
        const rawText = definedText.replace('\\', '');
        const tokens = textToTokens(rawText);

        return {
            tokens,
        };
    }

    private visitMacroSymbolLine(ctx: MacroInvocationContext): MacroTransformation | undefined {
        const token = <ExternalToken>this.tokenStream
            .tokenSource.tokenFactory.createSimple(
                UCLexer.INTEGER_LITERAL,
                (ctx._MACRO_SYMBOL.line - 1).toString(),
            );

        token.line = ctx._MACRO_SYMBOL.line;
        token.externalLine = ctx._MACRO_SYMBOL.line;

        return {
            tokens: [token]
        };
    }

    private visitMacroSymbolFile(ctx: MacroInvocationContext): MacroTransformation | undefined {
        const tokens = textToTokens(this.macroProvider.filePath.replaceAll('\\', '\\\\'));

        return {
            tokens
        };
    }
}
