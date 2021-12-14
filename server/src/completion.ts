import * as c3 from 'antlr4-c3';
import {
    CompletionItem, CompletionItemKind, SignatureHelp, SymbolKind
} from 'vscode-languageserver';
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
    Identifier, ISymbol, ObjectsTable, tryFindClassSymbol, UCClassSymbol, UCFieldSymbol,
    UCMethodSymbol, UCObjectTypeSymbol, UCStructSymbol, UCSymbol, UCTypeFlags
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

const packageOnlyFlags: UCTypeFlags = UCTypeFlags.Package & ~UCTypeFlags.Object;

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

    let globalTypes: UCTypeFlags = UCTypeFlags.Error;
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
                if (contexToken && contextSymbol instanceof UCStructSymbol) {
                    // FIXME: Hacky and assuming for this to only return a typeSymbol in the particular circumstances of this context.
                    UCCallExpression.hack_getTypeIfNoSymbol = true;
                    const resolvedTypeSymbol = contextSymbol.block?.getContainedSymbolAtPos(rangeFromBound(contexToken).start);
                    UCCallExpression.hack_getTypeIfNoSymbol = false;

                    // Only object types are allowed
                    if (resolvedTypeSymbol instanceof UCObjectTypeSymbol) {
                        const resolvedReference = resolvedTypeSymbol.getRef();
                        if (resolvedReference instanceof UCFieldSymbol) {
                            const symbolItems = resolvedReference
                                .getCompletionSymbols(
                                    document, '.',
                                    ((UCTypeFlags.Property | UCTypeFlags.Function) & ~UCTypeFlags.Object)
                                );

                            symbols.push(...symbolItems);

                            // A little hack to remove false positive keywords when possible
                            if (!(resolvedReference instanceof UCClassSymbol)) {
                                candidates.tokens.delete(UCParser.KW_DEFAULT);
                                candidates.tokens.delete(UCParser.KW_STATIC);
                                candidates.tokens.delete(UCParser.KW_CONST);
                            }
                        }
                        break;
                    }
                }

                if (contextSymbol instanceof UCStructSymbol && contextSymbol.block) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(
                            document, '',
                            ((
                                UCTypeFlags.Property
                                | UCTypeFlags.Function
                                | UCTypeFlags.Enum
                                | UCTypeFlags.Class
                                | UCTypeFlags.Const
                            ) & ~UCTypeFlags.Object)
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
                            .from(ObjectsTable.getAll<UCClassSymbol>())
                            .filter(symbol => (symbol.getTypeFlags() & (UCTypeFlags.Class | UCTypeFlags.Interface)) === UCTypeFlags.Class);

                        symbols.push(...typeItems);
                        break;
                    }

                    case UCParser.RULE_typeDecl: {
                        globalTypes |= ((UCTypeFlags.Enum | UCTypeFlags.Struct | UCTypeFlags.Class) & ~UCTypeFlags.Object);
                        break;
                    }

                    case UCParser.RULE_classType: {
                        globalTypes |= ((UCTypeFlags.Class) & ~UCTypeFlags.Object);
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= (UCTypeFlags.Class & ~UCTypeFlags.Object);
                        if (contextSymbol instanceof UCStructSymbol) {
                            const symbolItems = contextSymbol
                                .getCompletionSymbols(
                                    document, '',
                                    UCTypeFlags.Delegate
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
                        globalTypes |= UCTypeFlags.Interface | (packageOnlyFlags);
                        break;
                    }

                    case UCParser.RULE_extendsClause: {
                        switch (contextSymbol?.getKind()) {
                            case SymbolKind.Class: {
                                globalTypes |= (UCTypeFlags.Class & ~UCTypeFlags.Object) | (packageOnlyFlags);
                                break;
                            }

                            case SymbolKind.Struct: {
                                globalTypes |= ((UCTypeFlags.Struct | UCTypeFlags.Class) & ~UCTypeFlags.Object) | (packageOnlyFlags);
                                break;
                            }
                        }
                        break;
                    }

                    case UCParser.RULE_delegateType: {
                        globalTypes |= (UCTypeFlags.Class & ~UCTypeFlags.Object);
                        if (contextSymbol instanceof UCStructSymbol) {
                            const symbolItems = contextSymbol
                                .getCompletionSymbols(
                                    document, '',
                                    UCTypeFlags.Delegate
                                );
                            symbols.push(...symbolItems);
                        }
                        break;
                    }

                    case UCParser.RULE_typeDecl: {
                        globalTypes |= ((UCTypeFlags.Enum | UCTypeFlags.Struct) & ~UCTypeFlags.Object);
                        break;
                    }
                }
                break;
            }

            case UCParser.RULE_typeDecl: {
                if (stateType === UCParser.RULE_varType) {
                    globalTypes |= ((UCTypeFlags.Enum | UCTypeFlags.Struct | UCTypeFlags.Class) & ~UCTypeFlags.Object);
                }
                break;
            }

            case UCParser.RULE_functionName: {
                if (contextSymbol instanceof UCMethodSymbol) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(document, '', (UCTypeFlags.Function & ~UCTypeFlags.Object));
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_functionBody:
            case UCParser.RULE_codeBlockOptional: {
                if (contextSymbol instanceof UCStructSymbol) {
                    globalTypes |= ((UCTypeFlags.Enum | UCTypeFlags.Class) & ~UCTypeFlags.Object);
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(document, '',
                            ((
                                UCTypeFlags.Property
                                | UCTypeFlags.Function
                                | UCTypeFlags.Const
                            ) & ~UCTypeFlags.Object));
                    symbols.push(...symbolItems);
                }
                break;
            }

            case UCParser.RULE_defaultPropertiesBlock: {
                if (contextSymbol instanceof UCStructSymbol) {
                    const symbolItems = contextSymbol
                        .getCompletionSymbols(document, '',
                            ((
                                UCTypeFlags.Property
                                | UCTypeFlags.Delegate
                            ) & ~UCTypeFlags.Object));
                    symbols.push(...symbolItems);
                }
            }
        }
    }

    if (globalTypes !== UCTypeFlags.Error) {
        const typeItems = Array
            .from(ObjectsTable.getTypes(globalTypes))
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

function symbolToCompletionItem(symbol: ISymbol): CompletionItem {
    if (symbol instanceof UCSymbol) {
        return {
            label: symbol.getName().text,
            kind: symbol.getCompletionItemKind(),
            detail: symbol.getTooltip(),
            data: symbol.id
        };
    }

    return {
        label: symbol.getName().text
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