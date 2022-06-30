import * as c3 from 'antlr4-c3';
import { CompletionItem, CompletionItemKind, SignatureHelp } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';

import { UCLexer } from './UC/antlr/generated/UCLexer';
import { UCParser } from './UC/antlr/generated/UCParser';
import { DocumentParseData } from './UC/document';
import { UCCallExpression } from './UC/expressions';
import {
    backtrackFirstToken, backtrackFirstTokenOfType, getCaretTokenIndexFromStream,
    getDocumentContext, getIntersectingContext, rangeFromBound
} from './UC/helpers';
import { getDocumentByURI } from './UC/indexer';
import {
    ContextKind, Identifier, isClass, isField, isStruct, ISymbol, ObjectsTable, tryFindClassSymbol,
    UCClassSymbol, UCMethodSymbol, UCObjectTypeSymbol, UCSymbolKind
} from './UC/Symbols';

const PreferredRulesSet = new Set([
    UCParser.RULE_typeDecl,
    UCParser.RULE_qualifiedIdentifier, UCParser.RULE_identifier,
    UCParser.RULE_functionName, UCParser.RULE_functionBody,
    UCParser.RULE_codeBlockOptional,
    UCParser.RULE_defaultPropertiesBlock
]);

export const DefaultIgnoredTokensSet = new Set([
    UCLexer.WS,
    UCLexer.ID,
    UCLexer.INTERR,
    UCLexer.SHARP,
    UCLexer.PLUS,
    UCLexer.MINUS,
    UCLexer.DOT,
    UCLexer.AT,
    UCLexer.DOLLAR,
    UCLexer.BANG,
    UCLexer.AMP,
    UCLexer.BITWISE_OR,
    UCLexer.STAR,
    UCLexer.CARET,
    UCLexer.DIV,
    UCLexer.MODULUS,
    UCLexer.TILDE,
    UCLexer.LT,
    UCLexer.GT,
    UCLexer.OR,
    UCLexer.AND,
    UCLexer.EQ,
    UCLexer.NEQ,
    UCLexer.GEQ,
    UCLexer.LEQ,
    UCLexer.IEQ,
    UCLexer.MEQ,
    UCLexer.INCR,
    UCLexer.DECR,
    UCLexer.EXP,
    UCLexer.RSHIFT,
    UCLexer.LSHIFT,
    UCLexer.SHIFT,
    UCLexer.ASSIGNMENT,
    UCLexer.ASSIGNMENT_INCR,
    UCLexer.ASSIGNMENT_DECR,
    UCLexer.ASSIGNMENT_AT,
    UCLexer.ASSIGNMENT_DOLLAR,
    UCLexer.ASSIGNMENT_AND,
    UCLexer.ASSIGNMENT_OR,
    UCLexer.ASSIGNMENT_STAR,
    UCLexer.ASSIGNMENT_CARET,
    UCLexer.ASSIGNMENT_DIV,
    UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS,
    UCLexer.OPEN_BRACKET, UCLexer.CLOSE_BRACKET,
    UCLexer.OPEN_BRACE, UCLexer.CLOSE_BRACE,
    UCLexer.SEMICOLON, UCLexer.COLON,
    UCLexer.COMMA, UCLexer.EOF
]);

let currentIgnoredTokensSet = DefaultIgnoredTokensSet;

export function setIgnoredTokensSet(newSet: Set<number>) {
    currentIgnoredTokensSet = newSet;
}

export async function getSignatureHelp(uri: string, data: DocumentParseData | undefined, position: Position): Promise<SignatureHelp | undefined> {
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

export async function getCompletableSymbolItems(uri: string, data: DocumentParseData | undefined, position: Position): Promise<CompletionItem[] | undefined> {
    const document = getDocumentByURI(uri);
    if (!document || !data) {
        return undefined;
    }

    const cc = new c3.CodeCompletionCore(data.parser);
    // cc.showDebugOutput = true;
    cc.ignoredTokens = currentIgnoredTokensSet;
    cc.preferredRules = PreferredRulesSet;

    if (typeof data.context === 'undefined') {
        return;
    }

    const context = getIntersectingContext(data.context, position);
    if (typeof context === 'undefined') {
        return;
    }

    const caretTokenIndex = getCaretTokenIndexFromStream(data.parser.inputStream, position);
    const candidates = cc.collectCandidates(caretTokenIndex, context);

    const items: CompletionItem[] = [];
    const symbols: ISymbol[] = [];

    const contextSymbol = getDocumentContext(document, position);
    // console.log('completionItem::contextSymbol', contextSymbol?.getPath());

    let globalTypes: UCSymbolKind = UCSymbolKind.None;
    for (const [type, candiateRule] of candidates.rules) {
        // console.log('completionItem::type', data.parser.ruleNames[type]);

        const stateType = candiateRule.ruleList.length
            ? candiateRule.ruleList[candiateRule.ruleList.length - 1]
            : undefined;

        // console.log('completionItem::stateType', candiateRule.ruleList.map(t => t && data.parser.ruleNames[t]).join('.'));

        // Speculative approach...
        switch (type) {
            case UCParser.RULE_identifier: {
                let contexToken = backtrackFirstTokenOfType(data.parser.inputStream, UCParser.DOT, caretTokenIndex);
                if (contexToken) {
                    contexToken = backtrackFirstToken(data.parser.inputStream, contexToken.tokenIndex);
                }
                if (contexToken && isStruct(contextSymbol)) {
                    // FIXME: Hacky and assuming for this to only return a typeSymbol in the particular circumstances of this context.
                    UCCallExpression.hack_getTypeIfNoSymbol = true;
                    const resolvedTypeSymbol = contextSymbol.block?.getContainedSymbolAtPos(rangeFromBound(contexToken).start);
                    UCCallExpression.hack_getTypeIfNoSymbol = false;

                    // Only object types are allowed
                    if (resolvedTypeSymbol instanceof UCObjectTypeSymbol) {
                        const resolvedReference = resolvedTypeSymbol.getRef();
                        if (isField(resolvedReference)) {
                            const symbolItems = resolvedReference
                                .getCompletionSymbols(
                                    document,
                                    ContextKind.DOT,
                                    1 << UCSymbolKind.Property
                                    | 1 << UCSymbolKind.Function
                                );

                            symbols.push(...symbolItems);

                            // A little hack to remove false positive keywords when possible
                            if (!(isClass(resolvedReference))) {
                                candidates.tokens.delete(UCParser.KW_DEFAULT);
                                candidates.tokens.delete(UCParser.KW_STATIC);
                                candidates.tokens.delete(UCParser.KW_CONST);
                            }
                        }
                        break;
                    }
                }

                if (isStruct(contextSymbol) && contextSymbol.block) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(
                            document,
                            ContextKind.None,
                            1 << UCSymbolKind.Property
                            | 1 << UCSymbolKind.Function
                            | 1 << UCSymbolKind.Enum
                            | 1 << UCSymbolKind.Class
                            | 1 << UCSymbolKind.Const
                        );
                    symbols.push(...symbolItems);
                }

                switch (stateType) {
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
                            .from(ObjectsTable.getKinds<UCClassSymbol>(1 << UCSymbolKind.Class));

                        symbols.push(...typeItems);
                        break;
                    }

                    case UCParser.RULE_typeDecl: {
                        globalTypes |= 1 << UCSymbolKind.Enum | 1 << UCSymbolKind.ScriptStruct | 1 << UCSymbolKind.Class;
                        break;
                    }

                    case UCParser.RULE_classType: {
                        globalTypes |= 1 << UCSymbolKind.Class;
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= 1 << UCSymbolKind.Class;
                        if (isStruct(contextSymbol)) {
                            const symbolItems = contextSymbol
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
                switch (stateType) {
                    case UCParser.RULE_qualifiedIdentifierArguments: {
                        globalTypes |= 1 << UCSymbolKind.Interface | 1 << UCSymbolKind.Package;
                        break;
                    }

                    case UCParser.RULE_extendsClause: {
                        switch (contextSymbol?.kind) {
                            case 1 << UCSymbolKind.Class: {
                                globalTypes |= 1 << UCSymbolKind.Class | 1 << UCSymbolKind.Package;
                                break;
                            }

                            case 1 << UCSymbolKind.ScriptStruct: {
                                globalTypes |= 1 << UCSymbolKind.ScriptStruct | 1 << UCSymbolKind.Class | 1 << UCSymbolKind.Package;
                                break;
                            }
                        }
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= 1 << UCSymbolKind.Class;
                        if (isStruct(contextSymbol)) {
                            const symbolItems = contextSymbol
                                .getCompletionSymbols(
                                    document, ContextKind.None,
                                    1 << UCSymbolKind.Delegate
                                );
                            symbols.push(...symbolItems);
                        }
                        break;
                    }

                    case UCParser.RULE_typeDecl: {
                        globalTypes |= 1 << UCSymbolKind.Enum | 1 << UCSymbolKind.ScriptStruct;
                        break;
                    }
                }
                break;
            }

            case UCParser.RULE_typeDecl: {
                if (stateType === UCParser.RULE_varType) {
                    globalTypes |= 1 << UCSymbolKind.Enum | 1 << UCSymbolKind.ScriptStruct | 1 << UCSymbolKind.Class;
                }
                break;
            }

            case UCParser.RULE_functionName: {
                if (contextSymbol instanceof UCMethodSymbol) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(document, ContextKind.None, 1 << UCSymbolKind.Function);
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_functionBody:
            case UCParser.RULE_codeBlockOptional: {
                if (isStruct(contextSymbol)) {
                    globalTypes |= 1 << UCSymbolKind.Enum | 1 << UCSymbolKind.Class;
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(
                            document,
                            ContextKind.None,
                            1 << UCSymbolKind.Property
                            | 1 << UCSymbolKind.Function
                            | 1 << UCSymbolKind.Const
                        );
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_defaultPropertiesBlock: {
                if (isStruct(contextSymbol)) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(
                            document,
                            ContextKind.None,
                            1 << UCSymbolKind.Property
                            | 1 << UCSymbolKind.Delegate
                        );
                    symbols.push(...symbolItems);
                }
            }
        }
    }

    if (globalTypes !== UCSymbolKind.None) {
        const typeItems = Array
            .from(ObjectsTable.getKinds(globalTypes))
            .map(symbol => symbolToCompletionItem(symbol));

        items.push(...typeItems);
    }

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

    return items.concat(symbols.map(symbol => symbolToCompletionItem(symbol)));
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