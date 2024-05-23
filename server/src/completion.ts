import * as c3 from 'antlr4-c3/lib/src/CodeCompletionCore';
import { Parser, ParserRuleContext } from 'antlr4ts';
import { Token } from 'antlr4ts/Token';
import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode, SignatureHelp, SignatureInformation } from 'vscode-languageserver';
import { DocumentUri, Position } from 'vscode-languageserver-textdocument';

import { getCtxDebugInfo, getTokenDebugInfo } from './UC/Parser/Parser.utils';
import {
    ContextKind,
    DefaultArray,
    ISymbol,
    Identifier,
    IntrinsicArray,
    IntrinsicClass,
    MethodFlags,
    ModifierFlags,
    ObjectsTable,
    UCClassSymbol,
    UCConstSymbol,
    UCDelegateSymbol,
    UCEnumSymbol,
    UCFieldSymbol,
    UCMethodSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCPropertySymbol,
    UCQualifiedTypeSymbol,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
    areIdentityMatch,
    areMethodsCompatibleWith,
    findOrIndexClassSymbol,
    getSymbolDebugInfo,
    isClass,
    isDelegateSymbol,
    isEnumSymbol,
    isField,
    isFunction,
    isMethodSymbol,
    isPackage,
    isStruct,
    isTypeSymbol,
    resolveType,
    tryFindClassSymbol,
} from './UC/Symbols';
import { UCLexer } from './UC/antlr/generated/UCLexer';
import { CallExpressionContext, ProgramContext, UCParser } from './UC/antlr/generated/UCParser';
import { UCDocument } from './UC/document';
import { getSymbolTags } from './UC/documentSymbolTagsBuilder';
import { UCCallExpression } from './UC/expressions';
import {
    backtrackFirstToken,
    backtrackFirstTokenOfType,
    getCaretTokenFromStream,
    getDocumentContext,
    getIntersectingContext,
    getSymbolDocumentation,
    intersectsWithRange,
    positionFromToken,
    rangeFromBound,
    rangeFromBounds,
    resolveSymbolToRef,
} from './UC/helpers';
import { config, getDocumentByURI } from './UC/indexer';
import { toName } from './UC/name';
import { UCGeneration, UELicensee } from './UC/settings';
import { ActiveTextDocuments } from './activeTextDocuments';
import { UCLanguageServerSettings } from './configuration';

/** If the candidates collector hits any these it'll stop at the first occurance. */
const PreferredRulesSet = new Set([
    // UCParser.RULE_typeDecl,
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

function getParentRule(ctx: ParserRuleContext | undefined, ruleIndex: number): ParserRuleContext | undefined {
    while (ctx && ctx.ruleIndex !== ruleIndex) {
        ctx = ctx.parent;
    }

    return ctx;
}

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

export async function getCompletionItems(uri: DocumentUri, position: Position): Promise<CompletionItem[] | undefined> {
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
    return buildCompletionItems(document, position, { context: data.context, parser: data.parser });
}

export async function getSignatureHelp(uri: DocumentUri, position: Position): Promise<SignatureHelp | undefined> {
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
    return buildSignatureHelp(document, position, { context: data.context, parser: data.parser });
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
                && ((method.modifiers & ModifierFlags.Private) == 0 || (areIdentityMatch(method, contextSymbol)));
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

async function buildSignatureHelp(document: UCDocument, position: Position, data: {
    parser: Parser,
    context: ProgramContext
}): Promise<SignatureHelp | undefined> {
    const stream = data.parser.inputStream;
    const carretToken = getCaretTokenFromStream(stream, position);
    if (!carretToken) {
        console.warn(`No carret token at ${position.line}:${position.character}`);
        // throw new Error(`No carret token at ${position}`);
        return;
    }
    console.info(
        'signatureHelp::carretToken'.padEnd(42),
        getTokenDebugInfo(carretToken, data.parser));

    if (carretToken.channel === UCLexer.COMMENTS_CHANNEL || carretToken.channel === UCLexer.STRING_LITERAL) {
        return;
    }

    const carretRuleContext = getIntersectingContext(data.context, position);
    if (process.env.NODE_ENV === 'development') {
        console.debug(
            'signatureHelp::carretRuleContext'.padEnd(42),
            getCtxDebugInfo(carretRuleContext, data.parser));
    }

    // No c++ support, + this leads to an infinite loop with cc.collectCandiates.
    if (carretRuleContext?.ruleIndex === UCParser.RULE_exportBlockText) {
        return undefined;
    }

    let callExpression = carretRuleContext;
    while (callExpression !== undefined && !(callExpression instanceof CallExpressionContext)) {
        callExpression = getParentRule(callExpression.parent, UCParser.RULE_primaryExpression);
    }

    // Assert?
    if (!(callExpression instanceof CallExpressionContext)) {
        return undefined;
    }

    const scopeSymbol = getDocumentContext(document, position) as UCStructSymbol;
    console.info(
        'signatureHelp::scopeSymbol'.padEnd(42),
        getSymbolDebugInfo(scopeSymbol));

    // TODO: could be a call to a delegate within an array?
    const signatures: SignatureInformation[] = [];

    const invocationPosition = positionFromToken(callExpression.primaryExpression()._stop!);

    let activeParameter: number | undefined = undefined;
    const args = callExpression.arguments()?.children?.filter(c => c instanceof ParserRuleContext);
    if (args) {
        const stop = callExpression.CLOSE_PARENS()!._symbol;
        for (let i = args.length - 1; i >= 0; --i) {
            if (intersectsWithRange(position, rangeFromBounds((args[i] as ParserRuleContext).start, stop))) {
                activeParameter = i;
                break;
            }
        }
    }

    const invokedSymbol = scopeSymbol.getSymbolAtPos(invocationPosition);
    if (invokedSymbol) {
        console.info(
            'signatureHelp::invokedSymbol'.padEnd(42),
            getSymbolDebugInfo(invokedSymbol));

        const resolvedSymbol = resolveSymbolToRef(invokedSymbol);
        if (!resolvedSymbol) {
            return undefined;
        }

        const signature = buildSymbolSignature(resolvedSymbol);
        if (signature) {
            signatures.push(signature);
        }
    } else {
        const invocationToken = getCaretTokenFromStream(stream, invocationPosition);
        console.info(
            'signatureHelp::invokedToken'.padEnd(42),
            getTokenDebugInfo(invocationToken));

        if (!invocationToken) {
            return undefined;
        }

        // As the user is typing an identifier could either match a function or a class like say "Fire"
        // So we cannot reliable trust the indexed result, instead we'll always match a function instead.
        const unknownId = toName(invocationToken.text!);
        const classSymbol = findOrIndexClassSymbol(unknownId);
        if (classSymbol) {
            const classCastSignature = buildClassSignature(classSymbol);
            signatures.push(classCastSignature);
        }

        const methodSymbol = scopeSymbol.findSuperSymbol(unknownId);
        if (methodSymbol && isMethodSymbol(methodSymbol)) {
            const methodSignature = buildMethodSignature(methodSymbol);
            signatures.push(methodSignature);
        }
    }

    return {
        signatures,
        activeSignature: 0,
        activeParameter
    };
}

// TODO: other kinds? Perhaps auto completion for things like dependson(classname...)
function buildSymbolSignature(symbol: ISymbol): SignatureInformation | undefined {
    if (isClass(symbol)) {
        return buildClassSignature(symbol);
    }

    if (isMethodSymbol(symbol)) {
        return buildMethodSignature(symbol);
    }

    return undefined;
}

function buildClassSignature(symbol: UCClassSymbol): SignatureInformation {
    return {
        label: `${symbol.getPath()}(Object other)`,
        parameters: [
            {
                label: `Object other`
            }
        ]
    };
}

function buildMethodSignature(symbol: UCMethodSymbol): SignatureInformation {
    return {
        label: symbol.getTooltip(),
        parameters: symbol.params?.map(param => {
            return {
                label: param.getTextForSignature()
            };
        }),
    };
}

async function buildCompletionItems(
    document: UCDocument,
    position: Position,
    data: {
        parser: Parser,
        context: ProgramContext
    }): Promise<CompletionItem[] | undefined> {
    function getContextSymbols<T extends ISymbol = ISymbol>(symbol: UCObjectSymbol, kinds: UCSymbolKind): T[] {
        const symbolItems = symbol.getCompletionSymbols<T>(document, ContextKind.DOT, kinds);
        return symbolItems as T[];
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
    let candidates = cc.collectCandidates(leadingToken.tokenIndex, scopeRuleContext);
    if (carretRuleContext && candidates.rules.size === 0) {
        candidates = cc.collectCandidates(leadingToken.tokenIndex, carretRuleContext);
        if (candidates.rules.size === 0) {
            candidates.rules.set(carretRuleContext.ruleIndex, {
                startTokenIndex: leadingToken.tokenIndex,
                ruleList: [scopeRuleContext.ruleIndex, carretRuleContext.ruleIndex]
            });
        }
    }
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
        getSymbolDebugInfo(scopeSymbol));

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
        getSymbolDebugInfo(carretContextSymbol));
    console.info(
        'completion::carretSymbol'.padEnd(42),
        getSymbolDebugInfo(carretSymbol));
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
                            candidates.tokens.delete(UCParser.KW_SELF);
                            candidates.tokens.delete(UCParser.KW_ROT);
                            candidates.tokens.delete(UCParser.KW_RNG);
                            candidates.tokens.delete(UCParser.KW_VECT);

                            // Only object types are allowed
                            if (carretContextSymbol instanceof UCObjectTypeSymbol) {
                                const resolvedReference = carretContextSymbol.getRef();
                                if (isField(resolvedReference)) {
                                    const fieldType = resolvedReference.getType();
                                    // static class access? Either a property resolving to Class'Class'.Identifier or Class<MetaClass>.Identifier   
                                    if (resolvedReference === IntrinsicClass
                                        && carretContextSymbol.baseType instanceof UCObjectTypeSymbol
                                        && isClass(carretContextSymbol.baseType.getRef())) {
                                        candidates.tokens.clear();
                                        candidates.tokens.set(UCParser.KW_STATIC, [UCParser.KW_STATIC]);
                                        candidates.tokens.set(UCParser.KW_DEFAULT, [UCParser.KW_DEFAULT]);
                                        if (config.generation === UCGeneration.UC3) {
                                            candidates.tokens.set(UCParser.KW_CONST, [UCParser.KW_CONST]);
                                        }

                                        break;
                                    } else {
                                        //  FieldExpr.default.Identifier
                                        // candidates.tokens.delete(UCParser.KW_DEFAULT);
                                        // candidates.tokens.delete(UCParser.KW_STATIC);
                                        candidates.tokens.delete(UCParser.KW_CONST);
                                    }

                                    if (fieldType?.getRef() === IntrinsicArray) {
                                        candidates.tokens.clear();
                                    }

                                    switch (carretContextToken.type) {
                                        // Filter out any concrete functions
                                        case UCLexer.KW_STATIC: {
                                            const symbolItems = getContextSymbols<UCMethodSymbol>(
                                                resolvedReference,
                                                // Include events and delegates too, doesn't make sense but they are allowed.
                                                1 << UCSymbolKind.Function
                                                | 1 << UCSymbolKind.Event
                                                | 1 << UCSymbolKind.Delegate)
                                                .filter(symbol => {
                                                    // Don't include the overriding methods
                                                    return symbol.specifiers & MethodFlags.Static
                                                        && symbol.super == null
                                                        && ((symbol.modifiers & ModifierFlags.Private) == 0
                                                            || (symbol.outer == scopeSymbol.outer));
                                                });

                                            symbols.push(...symbolItems);

                                            break;
                                        }

                                        case UCLexer.KW_DEFAULT: {
                                            const symbolItems = getContextSymbols<UCPropertySymbol>(
                                                resolvedReference,
                                                1 << UCSymbolKind.Property)
                                                .filter(symbol => {
                                                    return ((symbol.modifiers & ModifierFlags.Private) == 0
                                                        || (symbol.outer == scopeSymbol.outer));
                                                });

                                            symbols.push(...symbolItems);

                                            break;
                                        }

                                        case UCLexer.KW_CONST: {
                                            const symbolItems = getContextSymbols<UCConstSymbol>(
                                                resolvedReference,
                                                1 << UCSymbolKind.Const
                                            );

                                            symbols.push(...symbolItems);

                                            break;
                                        }

                                        default: {
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

                                            break;
                                        }
                                    }
                                }

                                break;
                            }
                        }

                        // No context, include all scope symbols of all kinds.

                        // TODO: Hide non-concrete symbols if we are working in a static function.

                        // Remove the "Class<id>(expr)" keyword here, because we are already including the intrinsic class symbol.
                        candidates.tokens.delete(UCParser.KW_CLASS);

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
                                case UCTypeKind.Byte:
                                case UCTypeKind.Int:
                                case UCTypeKind.Bool:
                                case UCTypeKind.Float:
                                case UCTypeKind.String:
                                case UCTypeKind.Button:
                                case UCTypeKind.Array:
                                case UCTypeKind.Map:
                                case UCTypeKind.Pointer:
                                case UCTypeKind.Enum:
                                case UCTypeKind.Struct:
                                    candidates.tokens.delete(UCParser.NONE_LITERAL);
                                    break;
                            }

                            switch (typeKind) {
                                case UCTypeKind.Object:
                                    globalTypes |= 1 << UCSymbolKind.Class
                                        | 1 << UCSymbolKind.Interface
                                        | 1 << UCSymbolKind.Archetype
                                        | 1 << UCSymbolKind.Package;
                                    break;

                                case UCTypeKind.Bool:
                                    items.push(
                                        { label: 'false', kind: CompletionItemKind.Keyword },
                                        { label: 'true', kind: CompletionItemKind.Keyword }
                                    );
                                    break;

                                case UCTypeKind.Name:
                                    // Suggest names of objects maybe?
                                    shouldIncludeConstants = false;
                                    break;

                                case UCTypeKind.Enum:
                                case UCTypeKind.Byte: {
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
                }
                break;
            }

            case UCParser.RULE_typeDecl: {
                globalTypes |= 1 << UCSymbolKind.Enum
                    | 1 << UCSymbolKind.ScriptStruct;
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
                globalTypes |= 1 << UCSymbolKind.Class
                    | 1 << UCSymbolKind.Package;
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
        tags: getSymbolTags(symbol),
        detail: symbol.getTooltip(),
        data: symbol.id,
    };
}

export async function getFullCompletionItem(item: CompletionItem): Promise<CompletionItem> {
    // Assuming data has a reference to an @Identifier object.
    const id = item.data as Identifier | undefined;
    if (typeof id === 'object') {
        const symbol = tryFindClassSymbol(id.name);
        if (symbol) {
            item.documentation = getSymbolDocumentation(symbol)?.join('\r\n');
        }
    }
    return item;
}

/** Updates the ignored tokens set based on the given input's UnrealScript Generation. */
export function updateIgnoredCompletionTokens(settings: UCLanguageServerSettings): void {
    const ignoredTokensSet = new Set(DefaultIgnoredTokensSet);
    if (settings.generation === UCGeneration.UC1) {
        // class
        ignoredTokensSet.add(UCLexer.KW_EXTENDS);
        ignoredTokensSet.add(UCLexer.KW_NATIVE);
        ignoredTokensSet.add(UCLexer.KW_DEPRECATED);
        ignoredTokensSet.add(UCLexer.KW_EXPORT);
        ignoredTokensSet.add(UCLexer.KW_NOEXPORT);

        // TODO: Context aware ignored tokens.
        // ignoredTokensSet.add(UCLexer.KW_TRANSIENT);

        // var
        ignoredTokensSet.add(UCLexer.KW_EDITINLINE);
        ignoredTokensSet.add(UCLexer.KW_EDITINLINEUSE);
    }

    if (settings.generation === UCGeneration.UC3) {
        // class
        // ignoredTokensSet.add(UCLexer.KW_SAFEREPLACE);

        ignoredTokensSet.add(UCLexer.KW_CPPSTRUCT);

        // var
        ignoredTokensSet.add(UCLexer.KW_TRAVEL);
    }

    if (settings.generation !== UCGeneration.UC1) {
        // class
        ignoredTokensSet.add(UCLexer.KW_EXPANDS);
    }

    if (settings.generation !== UCGeneration.UC2) {
        // class
        ignoredTokensSet.add(UCLexer.KW_PARSECONFIG);

        // struct
        ignoredTokensSet.add(UCLexer.KW_LONG); // UE2.5

        // var
        ignoredTokensSet.add(UCLexer.KW_CACHE); // UE2.5
        ignoredTokensSet.add(UCLexer.KW_AUTOMATED); // UE2.5
        ignoredTokensSet.add(UCLexer.KW_EDITINLINENOTIFY); // UE2
        ignoredTokensSet.add(UCLexer.KW_EDFINDABLE);
        ignoredTokensSet.add(UCLexer.KW_EDITCONSTARRAY);
    }

    if (settings.generation !== UCGeneration.UC3) {
        // class
        // Some custom UE2 builds do have implements and interface
        ignoredTokensSet.add(UCLexer.KW_IMPLEMENTS);
        ignoredTokensSet.add(UCLexer.KW_INTERFACE);
        // ignoredTokensSet.add(UCLexer.KW_PEROBJECTLOCALIZED);

        ignoredTokensSet.add(UCLexer.KW_STRUCTDEFAULTPROPERTIES);
        ignoredTokensSet.add(UCLexer.KW_STRUCTCPPTEXT);

        // struct
        ignoredTokensSet.add(UCLexer.KW_ATOMIC);
        ignoredTokensSet.add(UCLexer.KW_ATOMICWHENCOOKED);
        ignoredTokensSet.add(UCLexer.KW_STRICTCONFIG);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLE);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLEWHENCOOKED);

        // var
        // Valid as a parameter modifier
        // ignoredTokensSet.add(UCLexer.KW_INIT);
        ignoredTokensSet.add(UCLexer.KW_EDITHIDE);
        ignoredTokensSet.add(UCLexer.KW_EDITFIXEDSIZE);
        ignoredTokensSet.add(UCLexer.KW_EDITORONLY);
        ignoredTokensSet.add(UCLexer.KW_EDITORTEXTBOX);
        ignoredTokensSet.add(UCLexer.KW_NOIMPORT);
        ignoredTokensSet.add(UCLexer.KW_NOCLEAR);
        ignoredTokensSet.add(UCLexer.KW_SERIALIZETEXT);
        ignoredTokensSet.add(UCLexer.KW_NONTRANSACTIONAL);
        // left out due conflict with class modifier
        // ignoredTokensSet.add(UCLexer.KW_INSTANCED);
        ignoredTokensSet.add(UCLexer.KW_DATABINDING);
        ignoredTokensSet.add(UCLexer.KW_DUPLICATETRANSIENT);
        ignoredTokensSet.add(UCLexer.KW_REPRETRY);
        ignoredTokensSet.add(UCLexer.KW_REPNOTIFY);
        ignoredTokensSet.add(UCLexer.KW_INTERP);
        // ignoredTokensSet.add(UCLexer.KW_DEPRECATED);
        ignoredTokensSet.add(UCLexer.KW_NOTFORCONSOLE);
        ignoredTokensSet.add(UCLexer.KW_ARCHETYPE);
        ignoredTokensSet.add(UCLexer.KW_CROSSLEVELACTIVE);
        ignoredTokensSet.add(UCLexer.KW_CROSSLEVELPASSIVE);
        ignoredTokensSet.add(UCLexer.KW_ALLOWABSTRACT);
        ignoredTokensSet.add(UCLexer.KW_PROTECTEDWRITE);
        ignoredTokensSet.add(UCLexer.KW_PRIVATEWRITE);

        // function
        ignoredTokensSet.add(UCLexer.KW_K2CALL);
        ignoredTokensSet.add(UCLexer.KW_K2OVERRIDE);
        ignoredTokensSet.add(UCLexer.KW_K2PURE);
        ignoredTokensSet.add(UCLexer.KW_CLIENT);
        ignoredTokensSet.add(UCLexer.KW_SERVER);
        ignoredTokensSet.add(UCLexer.KW_DEMORECORDING);
        ignoredTokensSet.add(UCLexer.KW_DLLIMPORT);
        ignoredTokensSet.add(UCLexer.KW_NOEXPORTHEADER);
        ignoredTokensSet.add(UCLexer.KW_VIRTUAL);
    }

    if (settings.licensee !== UELicensee.XCom) {
        ignoredTokensSet.add(UCLexer.KW_REF);
    }

    currentIgnoredTokensSet = ignoredTokensSet;
}
