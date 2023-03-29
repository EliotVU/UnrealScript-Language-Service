import * as c3 from 'antlr4-c3';
import { Parser, ParserRuleContext } from 'antlr4ts';
import { Token } from 'antlr4ts/Token';
import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode, SignatureHelp } from 'vscode-languageserver';
import { DocumentUri, Position } from 'vscode-languageserver-textdocument';

import { ActiveTextDocuments } from './activeTextDocuments';
import { UCLanguageServerSettings } from './settings';
import { UCLexer } from './UC/antlr/generated/UCLexer';
import { ProgramContext, UCParser } from './UC/antlr/generated/UCParser';
import { UCDocument } from './UC/document';
import { UCCallExpression } from './UC/expressions';
import {
    backtrackFirstToken,
    backtrackFirstTokenOfType,
    getCaretTokenFromStream,
    getDocumentContext,
    getIntersectingContext,
    rangeFromBound,
} from './UC/helpers';
import { config, getDocumentByURI, UCGeneration, UELicensee } from './UC/indexer';
import { toName } from './UC/name';
import { getCtxDebugInfo, getTokenDebugInfo } from './UC/Parser/Parser.utils';
import {
    areMethodsCompatibleWith,
    ContextKind,
    DefaultArray,
    getDebugSymbolInfo,
    Identifier,
    isClass,
    isDelegateSymbol,
    isEnumSymbol,
    isField,
    isFunction,
    isPackage,
    isStruct,
    isTypeSymbol,
    ISymbol,
    MethodFlags,
    ModifierFlags,
    ObjectsTable,
    resolveType,
    tryFindClassSymbol,
    UCClassSymbol,
    UCConstSymbol,
    UCDelegateSymbol,
    UCEnumSymbol,
    UCFieldSymbol,
    UCMethodSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCQualifiedTypeSymbol,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './UC/Symbols';

/** If the candidates collector hits any these it'll stop at the first occurance. */
const PreferredRulesSet = new Set([
    UCParser.RULE_typeDecl,
    UCParser.RULE_defaultIdentifierRef,
    UCParser.RULE_defaultQualifiedIdentifierRef,
    UCParser.RULE_qualifiedIdentifier, UCParser.RULE_identifier,
    // UCParser.RULE_codeBlockOptional,
    UCParser.RULE_classPropertyAccessSpecifier,
    // UCParser.RULE_objectLiteral,
]);

export const DefaultIgnoredTokensSet = new Set([
    UCLexer.WS,
    UCLexer.ID,
    UCLexer.INTERR,
    UCLexer.SHARP,
    UCLexer.PLUS, UCLexer.MINUS,
    UCLexer.DOT,
    UCLexer.AT, UCLexer.DOLLAR,
    UCLexer.BANG, UCLexer.AMP,
    UCLexer.BITWISE_OR,
    UCLexer.STAR, UCLexer.CARET, UCLexer.DIV,
    UCLexer.MODULUS, UCLexer.TILDE,
    UCLexer.LT, UCLexer.GT,
    UCLexer.OR, UCLexer.AND,
    UCLexer.EQ, UCLexer.NEQ,
    UCLexer.GEQ, UCLexer.LEQ,
    UCLexer.IEQ, UCLexer.MEQ,
    UCLexer.INCR, UCLexer.DECR,
    UCLexer.EXP,
    UCLexer.RSHIFT, UCLexer.LSHIFT, UCLexer.SHIFT,
    UCLexer.ASSIGNMENT,
    UCLexer.ASSIGNMENT_INCR, UCLexer.ASSIGNMENT_DECR,
    UCLexer.ASSIGNMENT_AT, UCLexer.ASSIGNMENT_DOLLAR,
    UCLexer.ASSIGNMENT_AND, UCLexer.ASSIGNMENT_OR,
    UCLexer.ASSIGNMENT_STAR, UCLexer.ASSIGNMENT_CARET, UCLexer.ASSIGNMENT_DIV,
    UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS,
    UCLexer.OPEN_BRACKET, UCLexer.CLOSE_BRACKET,
    UCLexer.OPEN_BRACE, UCLexer.CLOSE_BRACE,
    UCLexer.SEMICOLON, UCLexer.COLON,
    UCLexer.COMMA, UCLexer.EOF
]);

let currentIgnoredTokensSet = DefaultIgnoredTokensSet;

const TypeDeclSymbolKinds = 1 << UCSymbolKind.Enum
    | 1 << UCSymbolKind.ScriptStruct
    | 1 << UCSymbolKind.Class
    | 1 << UCSymbolKind.Interface;
// For qualified classes "Package.Class"
// | 1 << UCSymbolKind.Package;

// ClassType.Identifier
const ClassTypeContextSymbolKinds = 1 << UCSymbolKind.Enum
    | 1 << UCSymbolKind.ScriptStruct;

// PackageType.Identifier
const PackageTypeContextSymbolKinds = 1 << UCSymbolKind.Class
    | 1 << UCSymbolKind.Interface;

const TypeDeclContextSymbolKinds = 1 << UCSymbolKind.Class
    | 1 << UCSymbolKind.Interface;

// TODO: Also ScriptStruct such as Vector and Rotator
const GlobalCastSymbolKinds = 1 << UCSymbolKind.Class
    | 1 << UCSymbolKind.Interface;

const MethodSymbolKinds = 1 << UCSymbolKind.Function
    | 1 << UCSymbolKind.Event;

export async function getSignatureHelp(uri: DocumentUri, position: Position): Promise<SignatureHelp | undefined> {
    // const document = getDocumentByURI(uri);
    // if (!document || !data) {
    //     return undefined;
    // }

    // const cc = new c3.CodeCompletionCore(data.parser);
    // // cc.showDebugOutput = true;
    // cc.ignoredTokens = currentIgnoredTokensSet;
    // cc.preferredRules = PreferredRulesSet;

    // const context = data.context && getIntersectingContext(data.context, position);
    // const caretTokenIndex = getCaretTokenIndexFromStream(data.parser.inputStream, position);
    // const candidates = cc.collectCandidates(caretTokenIndex, context);

    // for (let [type, candiateRule] of candidates.rules) {
    //     // console.log('signatureHelp::type', data.parser.ruleNames[type]);

    //     const stateType = candiateRule.ruleList.length
    //         ? candiateRule.ruleList[candiateRule.ruleList.length - 1]
    //         : undefined;
    //     // console.log('signatureHelp::stateType', candiateRule.ruleList.map(t => t && data.parser.ruleNames[t]).join('.'));

    //     // Speculative approach...
    //     switch (type) {
    //         case UCParser.RULE_identifier:
    //         case UCParser.RULE_qualifiedIdentifier: {
    //             switch (stateType) {
    //                 case UCParser.RULE_qualifiedIdentifierArguments: {
    //                     return {
    //                         signatures: [{
    //                             label: 'implements (interface, ...interface)',
    //                             parameters: [{
    //                                 label: 'interface',
    //                             }],
    //                             activeParameter: 0
    //                         }],
    //                         activeSignature: 0,
    //                         activeParameter: null,
    //                     };
    //                     break;
    //                 }
    //             }
    //         }
    //     }
    // }
    return undefined;
}

export async function getCompletableSymbolItems(uri: DocumentUri, position: Position): Promise<CompletionItem[] | undefined> {
    // Do a fresh parse (but no indexing or transforming, we'll use the cached AST instead).
    const text = ActiveTextDocuments.get(uri)?.getText();
    if (typeof text === 'undefined') {
        return;
    }

    const document = getDocumentByURI(uri);
    if (!document) {
        return;
    }

    const data = document.parse(text);
    if (typeof data.context === 'undefined') {
        throw new Error('No parse context!');
    }
    return buildCompletableSymbolItems(document, position, { context: data.context, parser: data.parser });
}

function insertTextForFunction(symbol: UCMethodSymbol): string {
    const text: Array<string | undefined> = [];

    const modifiers = symbol.buildModifiers();
    if (modifiers.length > 0) {
        text.push(modifiers.join(' '));
    }
    text.push(symbol.buildTypeKeyword());
    if (symbol.returnValue) {
        text.push(symbol.returnValue.getTextForReturnValue());
    }
    text.push(symbol.getName().text + symbol.buildParameters());

    return text.filter(s => s).join(' ') + "\n{\n\t$0\n}";
}

function getOverridableMethods(document: UCDocument, contextSymbol: UCStructSymbol): UCMethodSymbol[] {
    return contextSymbol
        .getCompletionSymbols<UCMethodSymbol>(document, ContextKind.None, MethodSymbolKinds)
        .filter(method => {
            return method.super == null // filter out overridden duplicates
                && (method.modifiers & ModifierFlags.NonOverridable) == 0
                && (method.specifiers & MethodFlags.NonOverridable) == 0;
        });
}

function getCallableMethods(document: UCDocument, contextSymbol: UCStructSymbol): UCMethodSymbol[] {
    return contextSymbol
        .getCompletionSymbols<UCMethodSymbol>(document, ContextKind.None, MethodSymbolKinds)
        .filter(method => {
            return method.super == null
                && ((method.modifiers & ModifierFlags.Private) == 0 || (method.getHash() == contextSymbol.getHash()));
        });
}

function insertOverridableMethods(document: UCDocument, contextSymbol: UCStructSymbol, items: CompletionItem[]) {
    if (!contextSymbol.super) {
        return;
    }

    const symbolItems = getOverridableMethods(document, contextSymbol.super)
        .map(method => {
            const item = symbolToCompletionItem(method);
            item.insertText = insertTextForFunction(method);
            item.insertTextFormat = InsertTextFormat.Snippet;
            item.insertTextMode = InsertTextMode.adjustIndentation;
            return item;
        });
    items.push(...symbolItems);
}

function insertOverridableStates(document: UCDocument, contextSymbol: UCStructSymbol, symbols: ISymbol[]) {
    if (!contextSymbol.super) {
        return;
    }

    const symbolItems = contextSymbol
        .super
        .getCompletionSymbols<UCStateSymbol>(document, ContextKind.None, 1 << UCSymbolKind.State)
        .filter(method => {
            return (method.modifiers & ModifierFlags.NonOverridable) == 0;
        });
    symbols.push(...symbolItems);
}

async function buildCompletableSymbolItems(
    document: UCDocument,
    position: Position,
    data: {
        parser: Parser,
        context: ProgramContext
    }): Promise<CompletionItem[] | undefined> {
    function getContextSymbols(symbol: UCObjectSymbol, kinds: UCSymbolKind): ISymbol[] {
        const symbolItems = symbol.getCompletionSymbols(document, ContextKind.DOT, kinds);
        return symbolItems;
    }

    const stream = data.parser.inputStream;
    const carretToken = getCaretTokenFromStream(stream, position);
    if (!carretToken) {
        console.warn(`No carret token at ${position.line}:${position.character}`);
        // throw new Error(`No carret token at ${position}`);
        return;
    }
    console.info(
        'completion::carretToken'.padEnd(42),
        getTokenDebugInfo(carretToken, data.parser));

    if (carretToken.channel === UCLexer.COMMENTS_CHANNEL) {
        // TODO: In this case we could suggest parameters based on the scope symbol we can retrieve from the @leadingToken.
        return;
    }

    if (carretToken.type === UCLexer.STRING_LITERAL) {
        // TODO: We could suggest objects if used as an Object Literal (in a T3D context)
        return;
    }

    let leadingToken = carretToken;
    if (leadingToken.type === UCLexer.OPEN_PARENS
        || leadingToken.type === UCLexer.OPEN_BRACE
        || leadingToken.type === UCLexer.OPEN_BRACKET
        || leadingToken.type === UCLexer.LT
        || leadingToken.type === UCLexer.COMMA
        || leadingToken.type === UCLexer.DOT
        || leadingToken.type === UCLexer.ASSIGNMENT
        || leadingToken.type === UCLexer.SEMICOLON
        || leadingToken.type === UCLexer.COLON) {
        leadingToken = stream.get(leadingToken.tokenIndex + 1);
    }

    while (leadingToken.channel === UCLexer.HIDDEN
        || leadingToken.channel === UCLexer.COMMENTS_CHANNEL) {
        leadingToken = stream.get(leadingToken.tokenIndex + 1);
    }

    if (!leadingToken) {
        console.warn(`No leading carret token at ${position.line}:${position.character}`);
        // throw new Error(`No carret token at ${position}`);
        return;
    }
    console.info(
        'completion::leadingToken'.padEnd(42),
        getTokenDebugInfo(leadingToken, data.parser));

    const carretRuleContext = getIntersectingContext(data.context, position);
    if (process.env.NODE_ENV === 'development') {
        console.debug(
            'completion::carretRuleContext'.padEnd(42),
            getCtxDebugInfo(carretRuleContext, data.parser));
    }

    // No c++ support, + this leads to an infinite loop with cc.collectCandiates.
    if (carretRuleContext?.ruleIndex === UCParser.RULE_exportBlockText) {
        return undefined;
    }

    function getParentRule(ctx: ParserRuleContext | undefined, ruleIndex: number): ParserRuleContext | undefined {
        while (ctx && (ctx = ctx.parent)) {
            if (ctx.ruleIndex == ruleIndex) {
                return ctx;
            }
        }
        return undefined;
    }

    // Limit the context to RULE_member if possible
    const scopeRuleContext = getParentRule(carretRuleContext, UCParser.RULE_member) ?? data.context;
    console.info(
        'completion::scopeRuleContext'.padEnd(42),
        getCtxDebugInfo(scopeRuleContext, data.parser));

    const cc = new c3.CodeCompletionCore(data.parser);
    // cc.showResult = true;
    // cc.showRuleStack = true;
    // cc.showDebugOutput = true;
    cc.translateRulesTopDown = false;
    cc.ignoredTokens = currentIgnoredTokensSet;
    cc.preferredRules = PreferredRulesSet;
    const candidates = cc.collectCandidates(leadingToken.tokenIndex, scopeRuleContext);
    // if (process.env.NODE_ENV === 'development') {
    //     console.debug('completion::tokens', Array
    //         .from(candidates.tokens.keys())
    //         .map(type => data.parser.vocabulary.getLiteralName(type))
    //         .join("|"));
    // }

    /**
     * Resolves to a symbol that contains the current context. 
     * For example in a function this will always resolve to the UCMethodSymbol that we are working in.
     **/
    const scopeSymbol = getDocumentContext(document, position);
    console.info(
        'completion::scopeSymbol'.padEnd(42),
        getDebugSymbolInfo(scopeSymbol));

    /**
     * Resolves to a symbol that is either at the left of a "." or "=".
     * Useful for if we want to provide context sensitive completions for when we have an incomplete parser AST.
     **/
    let carretContextSymbol: ISymbol | undefined;
    let carretSymbol: ISymbol | undefined;

    let carretContextToken: Token | undefined;
    if (isStruct(scopeSymbol)) {
        if ((carretContextToken = backtrackFirstTokenOfType(stream, UCParser.DOT, carretToken.tokenIndex))
            && (carretContextToken = backtrackFirstToken(stream, carretContextToken.tokenIndex))) {
            // FIXME: Hacky and assuming for this to only return a typeSymbol in the particular circumstances of this context.
            UCCallExpression.hack_getTypeIfNoSymbol = true;
            carretContextSymbol = scopeSymbol.block?.getContainedSymbolAtPos(rangeFromBound(carretContextToken).start);
            UCCallExpression.hack_getTypeIfNoSymbol = false;
        } else if ((carretContextToken = backtrackFirstTokenOfType(stream, UCParser.ASSIGNMENT, carretToken.tokenIndex))
            && (carretContextToken = backtrackFirstToken(stream, carretContextToken.tokenIndex))) {
            UCCallExpression.hack_getTypeIfNoSymbol = true;
            carretContextSymbol = scopeSymbol.getContainedSymbolAtPos(rangeFromBound(carretContextToken).start);
            UCCallExpression.hack_getTypeIfNoSymbol = false;
        }

        carretSymbol = scopeSymbol.getSymbolAtPos(position);
    }
    console.info(
        'completion::carretContextToken'.padEnd(42),
        getTokenDebugInfo(carretContextToken, data.parser));
    console.info(
        'completion::carretContextSymbol'.padEnd(42),
        getDebugSymbolInfo(carretContextSymbol));
    console.info(
        'completion::carretSymbol'.padEnd(42),
        getDebugSymbolInfo(carretSymbol));
    const items: CompletionItem[] = [];
    const symbols: ISymbol[] = [];
    let globalTypes: UCSymbolKind = UCSymbolKind.None;
    let shouldIncludeTokenKeywords = true;

    if (candidates.rules.has(UCParser.RULE_member) || carretRuleContext?.ruleIndex == UCParser.RULE_program) {
        if (isStruct(scopeSymbol)) {
            insertOverridableMethods(document, scopeSymbol, items);
            insertOverridableStates(document, scopeSymbol, symbols);
        }
    }

    for (const [rule, candiateRule] of candidates.rules) {
        console.info(
            'completion::candidates.rules::rule'.padEnd(42),
            data.parser.ruleNames[rule]);

        const contextRule = candiateRule.ruleList.length
            ? candiateRule.ruleList[candiateRule.ruleList.length - 1]
            : undefined;

        function isWithin(rule: number): boolean {
            return candiateRule.ruleList.indexOf(rule) !== -1;
        }

        console.info(
            'completion::candidates.rules::contextRule'.padEnd(42),
            candiateRule.ruleList
                .map(t => t && data.parser.ruleNames[t])
                .join('.'));

        switch (contextRule) {
            case UCParser.RULE_functionReturnParam: {
                // Recommend return types, already handled by checking for rule:typeDecl
                break;
            }

            case UCParser.RULE_functionName: {
                if (isStruct(scopeSymbol)) {
                    const symbolItems = getOverridableMethods(document, scopeSymbol);
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_primaryExpression: {
                if (carretContextToken) {
                    break;
                }
                // casting
                globalTypes |= GlobalCastSymbolKinds;
            }
        }

        if (isStruct(scopeSymbol)) {
            // placeholder
            if (isWithin(UCParser.RULE_functionBody)) {
                switch (rule) {
                    case UCParser.RULE_identifier: {
                        break;
                    }
                }
            }

            if (isWithin(UCParser.RULE_statement)) {
                switch (rule) {
                    case UCParser.RULE_identifier: {
                        if (carretContextToken) {
                            // Only object types are allowed
                            if (carretContextSymbol instanceof UCObjectTypeSymbol) {
                                const resolvedReference = carretContextSymbol.getRef();
                                if (isField(resolvedReference)) {
                                    const symbolItems = getContextSymbols(
                                        resolvedReference,
                                        1 << UCSymbolKind.Property
                                        | 1 << UCSymbolKind.Function
                                        | 1 << UCSymbolKind.Event
                                        | 1 << UCSymbolKind.Delegate)
                                        .filter(symbol => {
                                            if (isFunction(symbol)) {
                                                // Don't include the overriding methods
                                                return symbol.super == null
                                                    && ((symbol.modifiers & ModifierFlags.Private) == 0
                                                        || (symbol.outer == scopeSymbol.outer));
                                            }
                                            return true;
                                        });

                                    symbols.push(...symbolItems);

                                    // A little hack to remove false positive keywords when possible
                                    if (!(isClass(resolvedReference))) {
                                        candidates.tokens.delete(UCParser.KW_DEFAULT);
                                        candidates.tokens.delete(UCParser.KW_STATIC);
                                        candidates.tokens.delete(UCParser.KW_CONST);
                                    } else if (config.generation != UCGeneration.UC3) {
                                        candidates.tokens.delete(UCParser.KW_CONST);
                                    }
                                }
                                break;
                            }
                        }

                        const symbolItems = scopeSymbol
                            .getCompletionSymbols(
                                document,
                                ContextKind.None,
                                1 << UCSymbolKind.Parameter
                                | 1 << UCSymbolKind.Local
                                | 1 << UCSymbolKind.Property
                                | 1 << UCSymbolKind.Function
                                | 1 << UCSymbolKind.Event
                                | 1 << UCSymbolKind.Delegate
                                | 1 << UCSymbolKind.Enum
                                | 1 << UCSymbolKind.Class
                                | 1 << UCSymbolKind.Const
                            ).filter(symbol => {
                                if (isFunction(symbol)) {
                                    // Don't include the overriding methods
                                    return symbol.super == null
                                        && ((symbol.modifiers & ModifierFlags.Private) == 0
                                            || (symbol.outer == scopeSymbol.outer));
                                }
                                return true;
                            });
                        symbols.push(...symbolItems);

                        break;
                    }
                }
            }

            if (isWithin(UCParser.RULE_defaultMemberCallExpression)) {
                switch (rule) {
                    case UCParser.RULE_identifier: {
                        // We can assign to properties and delegates here.
                        let kinds: UCSymbolKind = 1 << UCSymbolKind.Property
                            | 1 << UCSymbolKind.Delegate;

                        // Provide completions for array operations such Empty, e.g. as MyArray.Empty()
                        let scopeContextSymbol = scopeSymbol;
                        if (carretContextSymbol && isTypeSymbol(carretContextSymbol)) {
                            const letSymbol = carretContextSymbol.getRef<UCFieldSymbol>();
                            if (!letSymbol) break;

                            const letType = letSymbol?.getType();
                            if (letType == undefined) break;

                            const typeKind = letType.getTypeKind();
                            switch (typeKind) {
                                case UCTypeKind.Array:
                                    scopeContextSymbol = DefaultArray;
                                    kinds = 1 << UCSymbolKind.Function;
                                    break;
                            }
                        }

                        const symbolItems = scopeContextSymbol
                            .getCompletionSymbols(
                                document,
                                ContextKind.None,
                                kinds
                            );
                        symbols.push(...symbolItems);
                        break;
                    }
                }
            }
            else if (isWithin(UCParser.RULE_defaultValue)) {
                let shouldIncludeConstants = true;
                switch (rule) {
                    case UCParser.RULE_defaultIdentifierRef: {
                        if (carretContextSymbol && isTypeSymbol(carretContextSymbol)) {
                            const letSymbol = carretContextSymbol.getRef<UCFieldSymbol>();
                            if (!letSymbol) break;

                            const letType = (isDelegateSymbol(letSymbol)
                                ? carretContextSymbol
                                : letSymbol?.getType());
                            if (letType == undefined) break;

                            const typeKind = letType.getTypeKind();
                            switch (typeKind) {
                                case UCTypeKind.Object:
                                    globalTypes |= 1 << UCSymbolKind.Class
                                        | 1 << UCSymbolKind.Interface
                                        | 1 << UCSymbolKind.Archetype
                                        | 1 << UCSymbolKind.Package;
                                    break;

                                case UCTypeKind.Bool:
                                    candidates.tokens.delete(UCParser.NONE_LITERAL);
                                    items.push(
                                        { label: 'false', kind: CompletionItemKind.Keyword },
                                        { label: 'true', kind: CompletionItemKind.Keyword }
                                    );
                                    break;

                                case UCTypeKind.Float:
                                case UCTypeKind.Int:
                                case UCTypeKind.String:
                                case UCTypeKind.Array:
                                    // TODO: Figure out the extent of 'None' in a T3D context.
                                    candidates.tokens.delete(UCParser.NONE_LITERAL);
                                    break;

                                case UCTypeKind.Name:
                                    // Suggest names of objects maybe?
                                    shouldIncludeConstants = false;
                                    break;

                                case UCTypeKind.Enum:
                                case UCTypeKind.Byte: {
                                    candidates.tokens.delete(UCParser.NONE_LITERAL);

                                    const enumSymbol = resolveType(letType).getRef<UCEnumSymbol>();
                                    if (enumSymbol && isEnumSymbol(enumSymbol)) {
                                        symbols.push(enumSymbol); // context suggestion

                                        // TODO: Filter the .EnumCount tag or autocomplete the context?
                                        const symbolItems = enumSymbol
                                            .getCompletionSymbols<UCConstSymbol>(
                                                document,
                                                ContextKind.None,
                                                1 << UCSymbolKind.EnumTag
                                            );
                                        symbols.push(...symbolItems);
                                    }
                                    break;
                                }

                                case UCTypeKind.Delegate: {
                                    const delegateSource = resolveType(letType).getRef<UCDelegateSymbol>();
                                    const symbolItems = buildCompatibleDelegateTargets(scopeSymbol, delegateSource);
                                    symbols.push(...symbolItems);
                                    break;
                                }

                                case UCTypeKind.Struct: {
                                    const structSymbol = resolveType(letType).getRef<UCScriptStructSymbol>()!;
                                    const properties = structSymbol
                                        .getCompletionSymbols(
                                            document,
                                            ContextKind.None,
                                            1 << UCSymbolKind.Property
                                        )
                                        .reverse();

                                    let i = 0;
                                    const expressions = properties.map(symbol => `${symbol.getName().text}=$${++i}`);
                                    const structLiteralText = `(${expressions.join(',')})`;
                                    const snippet: CompletionItem = buildSnippetSymbol(structLiteralText);
                                    items.push(snippet);
                                    break;
                                }

                                default:
                                    break;
                            }

                            if (shouldIncludeConstants) {
                                const symbolItems = buildConstsOfType(scopeSymbol, typeKind);
                                symbols.push(...symbolItems);
                            }
                        }
                    }
                }
            }
        }

        // Speculative approach...
        switch (rule) {
            case UCParser.RULE_identifier: {
                switch (contextRule) {
                    case undefined:
                    case UCParser.RULE_classDecl: {
                        items.push({
                            label: document.name.text,
                            kind: CompletionItemKind.Class
                        });
                        break;
                    }

                    case UCParser.RULE_identifierArguments: {
                        const typeItems = Array
                            .from(ObjectsTable.enumerateKinds<UCClassSymbol>(1 << UCSymbolKind.Class))
                            .filter((classSymbol) => {
                                // TODO: Compare by hash instead of instance
                                // -- because a class could theoretically still reference an old copy.

                                // Exclude the dependency and inherited classes
                                for (let parent = (scopeSymbol as UCClassSymbol | undefined); parent; parent = parent.super) {
                                    if (parent == classSymbol) {
                                        return false;
                                    }
                                }

                                // Exclude classes that inherit the declared class
                                for (let parent = classSymbol.super; parent; parent = parent.super) {
                                    if (parent == scopeSymbol) {
                                        return false;
                                    }
                                }
                                return true;
                            });

                        symbols.push(...typeItems);
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= 1 << UCSymbolKind.Class;
                        if (isStruct(scopeSymbol)) {
                            const symbolItems = scopeSymbol
                                .getCompletionSymbols(
                                    document, ContextKind.None,
                                    1 << UCSymbolKind.Delegate
                                );
                            symbols.push(...symbolItems);
                        }
                        break;
                    }
                }
                break;
            }

            // TODO: suggest top-level contained symbols (e.g. Actor.ENetMode)
            case UCParser.RULE_qualifiedIdentifier: {
                switch (contextRule) {
                    case UCParser.RULE_qualifiedIdentifierArguments: {
                        globalTypes |= 1 << UCSymbolKind.Interface
                            | 1 << UCSymbolKind.Package;
                        break;
                    }

                    case UCParser.RULE_extendsClause: {
                        switch (scopeSymbol?.kind) {
                            case UCSymbolKind.Class: {
                                globalTypes |= 1 << UCSymbolKind.Class
                                    | 1 << UCSymbolKind.Package;
                                break;
                            }

                            case UCSymbolKind.ScriptStruct: {
                                globalTypes |= 1 << UCSymbolKind.ScriptStruct
                                    | 1 << UCSymbolKind.Class
                                    | 1 << UCSymbolKind.Package;
                                break;
                            }
                        }
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= 1 << UCSymbolKind.Class;
                        if (isStruct(scopeSymbol)) {
                            const symbolItems = scopeSymbol
                                .getCompletionSymbols(
                                    document, ContextKind.None,
                                    1 << UCSymbolKind.Delegate
                                );
                            symbols.push(...symbolItems);
                        }
                        break;
                    }

                    case UCParser.RULE_typeDecl: {
                        globalTypes |= 1 << UCSymbolKind.Enum
                            | 1 << UCSymbolKind.ScriptStruct;
                        break;
                    }
                }
                break;
            }

            case UCParser.RULE_typeDecl: {
                let contextSymbol: ISymbol | undefined;
                if (carretContextSymbol) {
                    if (UCQualifiedTypeSymbol.is(carretContextSymbol)) {
                        contextSymbol = carretContextSymbol.left?.getRef();
                    } else if (isTypeSymbol(carretContextSymbol)) {
                        contextSymbol = carretContextSymbol.getRef();
                    }
                } else if (carretContextToken) {
                    shouldIncludeTokenKeywords = false;

                    const id = toName(carretContextToken.text as string);
                    // Only look for a class in a context of "ClassType.Type"
                    contextSymbol = ObjectsTable.getSymbol<UCClassSymbol>(id, UCSymbolKind.Class);
                } else {
                    globalTypes |= TypeDeclSymbolKinds;
                }

                if (contextSymbol) {
                    if (isPackage(contextSymbol)) {
                        for (const symbol of ObjectsTable.enumerateKinds(PackageTypeContextSymbolKinds)) {
                            if (symbol.outer !== contextSymbol) {
                                continue;
                            }
                            symbols.push(symbol);
                        }
                    } else if (isClass(contextSymbol)) {
                        const symbolItems = contextSymbol.getCompletionSymbols(
                            document,
                            ContextKind.None,
                            ClassTypeContextSymbolKinds);
                        symbols.push(...symbolItems);
                    }
                }
                break;
            }

            case UCParser.RULE_functionDecl: {
                if (isStruct(scopeSymbol)) {
                    const symbolItems = getOverridableMethods(document, scopeSymbol);
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_functionName: {
                if (isStruct(scopeSymbol)) {
                    const symbolItems = getOverridableMethods(document, scopeSymbol);
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_functionBody:
            case UCParser.RULE_codeBlockOptional: {
                if (isStruct(scopeSymbol)) {
                    globalTypes |= 1 << UCSymbolKind.Enum | 1 << UCSymbolKind.Class;
                    const symbolItems = scopeSymbol
                        .getCompletionSymbols(
                            document,
                            ContextKind.None,
                            1 << UCSymbolKind.Parameter
                            | 1 << UCSymbolKind.Local
                            | 1 << UCSymbolKind.Property
                            | 1 << UCSymbolKind.Function
                            | 1 << UCSymbolKind.Delegate
                            | 1 << UCSymbolKind.Event
                            | 1 << UCSymbolKind.Const
                        )
                        .filter(symbol => {
                            if (isFunction(symbol)) {
                                // Don't include the overriding methods
                                return symbol.super == null
                                    && ((symbol.modifiers & ModifierFlags.Private) == 0
                                        || (symbol.outer == scopeSymbol.outer));
                            }
                            return true;
                        });
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_objectLiteral: {
                globalTypes |= 1 << UCSymbolKind.Class;
                break;
            }
        }
    }

    if (globalTypes !== UCSymbolKind.None) {
        const typeItems = Array
            .from(ObjectsTable.enumerateKinds(globalTypes))
            .map(symbol => symbolToCompletionItem(symbol));

        items.push(...typeItems);
    }

    if (shouldIncludeTokenKeywords) {
        for (const [type, tokens] of candidates.tokens) {
            const name = data.parser.vocabulary.getLiteralName(type);
            if (typeof name === 'undefined') {
                continue;
            }

            // Assume that the name is single quoted.
            const tokenName = name.substring(1, name.length - 1);
            items.push({
                label: tokenName,
                kind: CompletionItemKind.Keyword
            });
        }
    }

    return items.concat(symbols.map(symbol => symbolToCompletionItem(symbol)));

    function buildSnippetSymbol(insertText: string): CompletionItem {
        return {
            label: '(...)',
            kind: CompletionItemKind.Snippet,
            preselect: true,
            insertText: insertText,
            insertTextFormat: InsertTextFormat.Snippet,
            insertTextMode: InsertTextMode.adjustIndentation
        };
    }

    function buildConstsOfType(scopeSymbol: UCStructSymbol, typeKind: UCTypeKind) {
        return scopeSymbol
            .getCompletionSymbols<UCConstSymbol>(
                document,
                ContextKind.None,
                1 << UCSymbolKind.Const
            )
            .filter(symbol => {
                const type = symbol.getType();
                if (type && type.getTypeKind() != typeKind) {
                    return false;
                }
                // Filter invalid types
                return true;
            });
    }

    function buildCompatibleDelegateTargets(scope: UCStructSymbol, delegateSource: UCDelegateSymbol | undefined) {
        return scope
            .getCompletionSymbols<UCMethodSymbol>(
                document,
                ContextKind.None,
                1 << UCSymbolKind.Function
                | 1 << UCSymbolKind.Event
            )
            .filter(symbol => {
                // Exclude methods that are overriding a parent's method.
                if (symbol.super) {
                    return false;
                }
                // Exclude private functions that don't belong to the current scope.
                if (((symbol.modifiers & ModifierFlags.Private) != 0
                    && (symbol.outer != scope.outer))) {
                    return false;
                }
                if (!delegateSource || areMethodsCompatibleWith(symbol, delegateSource)) {
                    return true;
                }
                return false;
            });
    }
}

const CompletionItemKindMap = new Map<UCSymbolKind, CompletionItemKind>([
    [UCSymbolKind.Package, CompletionItemKind.Module],
    [UCSymbolKind.Archetype, CompletionItemKind.Reference],
    [UCSymbolKind.ScriptStruct, CompletionItemKind.Struct],
    [UCSymbolKind.State, CompletionItemKind.Reference],
    [UCSymbolKind.Class, CompletionItemKind.Class],
    [UCSymbolKind.Interface, CompletionItemKind.Interface],
    [UCSymbolKind.Const, CompletionItemKind.Constant],
    [UCSymbolKind.Enum, CompletionItemKind.Enum],
    [UCSymbolKind.EnumTag, CompletionItemKind.EnumMember],
    [UCSymbolKind.Property, CompletionItemKind.Property],
    [UCSymbolKind.Parameter, CompletionItemKind.Variable],
    [UCSymbolKind.Local, CompletionItemKind.Variable],
    [UCSymbolKind.Function, CompletionItemKind.Function],
    [UCSymbolKind.Event, CompletionItemKind.Event],
    [UCSymbolKind.Delegate, CompletionItemKind.Event],
    [UCSymbolKind.Operator, CompletionItemKind.Operator],
    [UCSymbolKind.ReplicationBlock, CompletionItemKind.Reference],
    [UCSymbolKind.DefaultPropertiesBlock, CompletionItemKind.Reference],
]);

function symbolToCompletionItem(symbol: ISymbol): CompletionItem {
    const kind = CompletionItemKindMap.get(symbol.kind) ?? CompletionItemKind.Text;
    return {
        label: symbol.id.name.text,
        kind: kind,
        detail: symbol.getTooltip(),
        data: symbol.id
    };
}

export async function getFullCompletionItem(item: CompletionItem): Promise<CompletionItem> {
    // Assuming data has a reference to an @Identifier object.
    const id = item.data as Identifier | undefined;
    if (typeof id === 'object') {
        const symbol = tryFindClassSymbol(id.name);
        if (symbol) {
            item.documentation = symbol.getDocumentation();
        }
    }
    return item;
}

/** Updates the ignored tokens set based on the given input's UnrealScript Generation. */
export function updateIgnoredCompletionTokens(settings: UCLanguageServerSettings): void {
    const ignoredTokensSet = new Set(DefaultIgnoredTokensSet);
    if (settings.generation === UCGeneration.UC1) {
        ignoredTokensSet.add(UCLexer.KW_EXTENDS);
        ignoredTokensSet.add(UCLexer.KW_NATIVE);

        // TODO: Context aware ignored tokens.
        // ignoredTokensSet.add(UCLexer.KW_TRANSIENT);
        ignoredTokensSet.add(UCLexer.KW_LONG);
    } else {
        ignoredTokensSet.add(UCLexer.KW_EXPANDS);
        ignoredTokensSet.add(UCLexer.KW_INTRINSIC);
    }

    if (settings.generation === UCGeneration.UC3) {
        ignoredTokensSet.add(UCLexer.KW_CPPSTRUCT);
    } else {
        // Some custom UE2 builds do have implements and interface
        ignoredTokensSet.add(UCLexer.KW_IMPLEMENTS);
        ignoredTokensSet.add(UCLexer.KW_INTERFACE);

        ignoredTokensSet.add(UCLexer.KW_STRUCTDEFAULTPROPERTIES);
        ignoredTokensSet.add(UCLexer.KW_STRUCTCPPTEXT);

        ignoredTokensSet.add(UCLexer.KW_ATOMIC);
        ignoredTokensSet.add(UCLexer.KW_ATOMICWHENCOOKED);
        ignoredTokensSet.add(UCLexer.KW_STRICTCONFIG);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLE);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLEWHENCOOKED);
    }

    if (settings.licensee !== UELicensee.XCom) {
        ignoredTokensSet.add(UCLexer.KW_REF);
    }

    currentIgnoredTokensSet = ignoredTokensSet;
}