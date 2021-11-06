import * as c3 from 'antlr4-c3';
import { ParserRuleContext, Token, TokenStream } from 'antlr4ts';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    CodeAction, CompletionItem, CompletionItemKind, DocumentHighlight, DocumentHighlightKind, Hover,
    Location, Position, Range, SymbolInformation
} from 'vscode-languageserver';

import { UCLexer } from './antlr/generated/UCLexer';
import { UCParser } from './antlr/generated/UCParser';
import { DocumentParseData, UCDocument } from './document';
import { DocumentCodeActionsBuilder } from './documentCodeActionsBuilder';
import { config, getDocumentByURI, getIndexedReferences, UCGeneration } from './indexer';
import { TokenExt } from './Parser/CommonTokenStreamExt';
import {
    Identifier, ISymbol, IWithReference, ObjectsTable, tryFindClassSymbol, UCClassSymbol,
    UCFieldSymbol, UCMethodSymbol, UCStructSymbol, UCSymbol, UCTypeFlags
} from './Symbols';

export const VALID_ID_REGEXP = RegExp(/^([a-zA-Z_][a-zA-Z_0-9]*)$/);

export function rangeFromBound(token: Token): Range {
	const length = (token as TokenExt).length;
	const line = token.line - 1;
	const start: Position = {
		line,
		character: token.charPositionInLine
	};
	const end: Position = {
		line,
		character: token.charPositionInLine + length
	};
	return { start, end };
}

export function rangeFromBounds(startToken: Token, stopToken: Token = startToken): Range {
	const length = (stopToken as TokenExt).length;
	const start: Position = {
		line: startToken.line - 1,
		character: startToken.charPositionInLine
	};
	const end: Position = {
		line: stopToken.line - 1,
		character: stopToken.charPositionInLine + length
	};
	return { start, end };
}

export function rangeFromCtx(ctx: ParserRuleContext): Range {
	const length = (ctx.stop as TokenExt).length;
	const start = {
		line: ctx.start.line - 1,
		character: ctx.start.charPositionInLine
	};
	const end: Position = {
		line: ctx.stop!.line - 1,
		character: ctx.stop!.charPositionInLine + length
	};
	return { start, end };
}

export function intersectsWith(range: Range, position: Position): boolean {
	if (position.line < range.start.line || position.line > range.end.line) {
		return false;
	}

	if (range.start.line === range.end.line) {
		return position.character >= range.start.character && position.character < range.end.character;
	}

	if (position.line === range.start.line) {
		return position.character >= range.start.character;
	}

	if (position.line === range.end.line) {
		return position.character <= range.end.character;
	}
	return true;
}

export function intersectsWithRange(position: Position, range: Range): boolean {
	return position.line >= range.start.line
		&& position.line <= range.end.line
		&& position.character >= range.start.character
		&& position.character < range.end.character;
}

function getDocumentSymbol(document: UCDocument, position: Position): ISymbol | undefined {
	const symbols = document.getSymbols();
	for (let symbol of symbols) {
		const child = symbol.getSymbolAtPos(position);
		if (child) {
			return child;
		}
	}
	return undefined;
}

/**
 * Returns the deepest UCStructSymbol that is intersecting with @param position
 **/
function getDocumentContext(document: UCDocument, position: Position): ISymbol | undefined {
	const symbols = document.getSymbols();
	for (let symbol of symbols) {
		if (symbol instanceof UCFieldSymbol) {
			const child = symbol.getCompletionContext(position);
			if (child) {
				return child;
			}
		}
	}
	return undefined;
}

export async function getSymbolTooltip(uri: string, position: Position): Promise<Hover | undefined> {
	const document = getDocumentByURI(uri);
	const ref = document && getDocumentSymbol(document, position);
	if (ref && ref instanceof UCSymbol) {
		const contents = [{ language: 'unrealscript', value: ref.getTooltip() }];

		const documentation = ref.getDocumentation();
		if (documentation) {
			contents.push({ language: 'unrealscript', value: documentation });
		}

		return {
			contents,
			range: ref.id.range
		};
	}
}

export async function getSymbolDefinition(uri: string, position: Position): Promise<ISymbol | undefined> {
	const document = getDocumentByURI(uri);
	const ref = document && getDocumentSymbol(document, position) as unknown as IWithReference;
	if (!ref) {
		return undefined;
	}

	const symbol = ref.getRef?.();
	if (symbol instanceof UCSymbol) {
		return symbol;
	}
	return ref;
}

export async function getSymbol(uri: string, position: Position): Promise<ISymbol | undefined> {
	const document = getDocumentByURI(uri);
	return document && getDocumentSymbol(document, position);
}

export async function getSymbols(uri: string): Promise<SymbolInformation[] | undefined> {
	const document = getDocumentByURI(uri);
	if (!document) {
		return undefined;
	}

	const contextSymbols: SymbolInformation[] = document.getSymbols().map(s => s.toSymbolInfo());
	const buildSymbolsList = (container: UCStructSymbol) => {
		for (let child = container.children; child; child = child.next) {
			contextSymbols.push(child.toSymbolInfo());
			if (child instanceof UCStructSymbol) {
				buildSymbolsList(child as UCStructSymbol);
			}
		}
	};

	for (let symbol of contextSymbols) {
		if (symbol instanceof UCStructSymbol) {
			buildSymbolsList(symbol);
		}
	}
	return contextSymbols;
}

export async function getSymbolReferences(uri: string, position: Position): Promise<Location[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!symbol) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getHash());
	if (!references) {
		return undefined;
	}
	return Array.from(references.values())
		.map(ref => ref.location);
}

export async function getSymbolHighlights(uri: string, position: Position): Promise<DocumentHighlight[] | undefined> {
	const symbol = await getSymbolDefinition(uri, position);
	if (!symbol) {
		return undefined;
	}

	const references = getIndexedReferences(symbol.getHash());
	if (!references) {
		return undefined;
	}

	return Array
		.from(references.values())
		.filter(loc => loc.location.uri === uri)
		.map(ref => DocumentHighlight.create(
			ref.location.range,
			ref.inAssignment
				? DocumentHighlightKind.Write
				: DocumentHighlightKind.Read
		));
}

export async function getCompletableSymbolItems(uri: string, data: DocumentParseData | undefined, position: Position): Promise<CompletionItem[] | undefined> {
	const document = getDocumentByURI(uri);
	if (!document || !data) {
		return undefined;
	}

	const getIntersectingContext = (context?: ParserRuleContext): ParserRuleContext | undefined => {
		if (!context) {
			return undefined;
		}

		if (intersectsWith(rangeFromBounds(context.start, context.stop), position)) {
			if (context.children) for (let child of context.children) {
				if (child instanceof ParserRuleContext) {
					const ctx = getIntersectingContext(child);
					if (ctx) {
						return ctx;
					}
				}
			}
			return context;
		}
		return undefined;
	};

	const getCaretTokenIndex = (context?: ParserRuleContext): number => {
		if (!context) {
			return 0;
		}
		if (context.children) for (let child of context.children) {
            if (child instanceof TerminalNode) {
				if (intersectsWithRange(position, rangeFromBound(child.symbol))) {
					return child.symbol.tokenIndex;
				}
            }
        }
		return 0;
	};

	const getCaretTokenIndexFromStream = (stream: TokenStream): number => {
		let i = 0;
		let token: Token | undefined = undefined;
		while (token = stream.get(i)) {
			if (position.line === token.line - 1
				&& position.character >= token.charPositionInLine
				&& position.character < token.charPositionInLine + token.text!.length) {
				return token.tokenIndex;
			}
			++ i;
		}
		return 0;
	};

	const core = new c3.CodeCompletionCore(data.parser);
	core.ignoredTokens = new Set([
		UCLexer.ID,
		UCLexer.PLUS, UCLexer.MINUS,
		UCLexer.STAR, UCLexer.BITWISE_OR,
		UCLexer.ASSIGNMENT,
		UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS,
		UCLexer.OPEN_BRACKET, UCLexer.CLOSE_BRACKET,
		UCLexer.OPEN_BRACE, UCLexer.CLOSE_BRACE,
		UCLexer.LSHIFT, UCLexer.RSHIFT,
		UCLexer.SEMICOLON, UCLexer.COLON, UCLexer.COMMA
	]);

	if (config.generation === UCGeneration.UC1) {
		core.ignoredTokens.add(UCLexer.KW_EXTENDS);
		core.ignoredTokens.add(UCLexer.KW_NATIVE);
	} else {
		core.ignoredTokens.add(UCLexer.KW_EXPANDS);
		core.ignoredTokens.add(UCLexer.KW_INTRINSIC);
	}

	if (config.generation === UCGeneration.UC3) {
		core.ignoredTokens.add(UCLexer.KW_CPPSTRUCT);
	} else {
		core.ignoredTokens.add(UCLexer.KW_STRUCTDEFAULTPROPERTIES);
		core.ignoredTokens.add(UCLexer.KW_STRUCTCPPTEXT);
	}

	core.preferredRules = new Set([
		UCParser.RULE_varDecl, UCParser.RULE_paramDecl, UCParser.RULE_localDecl,
		UCParser.RULE_typeDecl, UCParser.RULE_primitiveType, UCParser.RULE_qualifiedIdentifier, UCParser.RULE_identifier,
		UCParser.RULE_arrayType, UCParser.RULE_classType, UCParser.RULE_delegateType, UCParser.RULE_mapType,
		UCParser.RULE_functionName, UCParser.RULE_functionBody,
		UCParser.RULE_codeBlockOptional, UCParser.RULE_statement
	]);

	const context = getIntersectingContext(data.context);
	const caret = getCaretTokenIndexFromStream(data.parser.inputStream);
	const candidates = core.collectCandidates(caret, context);

	const items: CompletionItem[] = [];
	for (let [ type ] of candidates.tokens) {
		const displayName = data.parser.vocabulary.getDisplayName(type);
		const tokenName = displayName.substring(1, displayName.length - 2);
		if (!VALID_ID_REGEXP.test(tokenName)) {
			continue;
		}
		items.push({
			label: tokenName,
			kind: CompletionItemKind.Keyword
		});
	}

	const contextSymbol = getDocumentContext(document, position);
	for (let [ rule, rules ] of candidates.rules) {
		switch (rule) {
			// TODO: suggest top-level contained symbols (e.g. Actor.ENetMode)
			case UCParser.RULE_qualifiedIdentifier: {
				if (context?.parent) {
					if (context.parent.ruleIndex !== UCParser.RULE_typeDecl) {
						break;
					}
				}
			}

			case UCParser.RULE_identifier: {
				if (context?.parent?.ruleIndex === UCParser.RULE_functionName) {
					if (contextSymbol instanceof UCMethodSymbol) {
						const symbolItems = contextSymbol
							.getCompletionSymbols(document, '', UCTypeFlags.Function)
							.map(symbol => symbolToCompletionItem(symbol));

						items.push(...symbolItems);
					}
					break;
				}

				if (context?.parent?.ruleIndex !== UCParser.RULE_qualifiedIdentifier) {
					// Do not suggest any items (except for generic tokens)
					return [];
				}
			}

			case UCParser.RULE_typeDecl: case UCParser.RULE_primitiveType: {
				const typeItems = Array
					.from(ObjectsTable.getAll())
					.map(symbol => symbolToCompletionItem(symbol));

				items.push(...typeItems);
				break;
			}

			case UCParser.RULE_classType: {
				const typeItems = Array
					.from(ObjectsTable.getAll<UCClassSymbol>())
					.filter(symbol => symbol.getKind() === UCTypeFlags.Class)
					.map(symbol => symbolToCompletionItem(symbol));

				items.push(...typeItems);
			}

			case UCParser.RULE_delegateType: {
				const typeItems = Array
					.from(ObjectsTable.getAll<UCClassSymbol>())
					.filter(symbol => symbol.getKind() === UCTypeFlags.Class)
					.map(symbol => symbolToCompletionItem(symbol));

				items.push(...typeItems);

				// if (contextSymbol instanceof UCStructSymbol) {
				// 	const symbolItems = contextSymbol
				// 		.getCompletionSymbols(document, '', UCTypeFlags.Function)
				// 		.map(symbol => symbolToCompletionItem(symbol));

				// 	items.push(...symbolItems);
				// }
			}

			case UCParser.RULE_functionName: {
				if (contextSymbol instanceof UCMethodSymbol) {
					const symbolItems = contextSymbol
						.getCompletionSymbols(document, '', UCTypeFlags.Function)
						.map(symbol => symbolToCompletionItem(symbol));

					items.push(...symbolItems);
				}
				break;
			}

			case UCParser.RULE_codeBlockOptional:
			case UCParser.RULE_statement: {
				if (contextSymbol instanceof UCStructSymbol) {
					const symbolItems = contextSymbol
						.getCompletionSymbols(document, '')
						.map(symbol => symbolToCompletionItem(symbol));

					items.push(...symbolItems);
				}
				break;
			}
		}
	}
	return items;
}

function symbolToCompletionItem(symbol: ISymbol): CompletionItem {
	if (symbol instanceof UCSymbol) {
		return {
			label: symbol.getName().toString(),
			kind: symbol.getCompletionItemKind(),
			detail: symbol.getTooltip(),
			data: symbol.id
		};
	}

	return {
		label: symbol.getName().toString()
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

export async function getCodeActions(uri: string, range: Range): Promise<CodeAction[] | undefined> {
	const document = getDocumentByURI(uri);
    if (!document) {
        return undefined;
    }

    const position = range.start;
    const symbol = getDocumentSymbol(document, position);
    if (symbol) {
        const builder = new DocumentCodeActionsBuilder(document);
        symbol.accept(builder);
        return builder.codeActions;
    }
    return undefined;
}