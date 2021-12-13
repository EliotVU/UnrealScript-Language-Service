import { ParserRuleContext, Token, TokenStream } from 'antlr4ts';
import {
    CodeAction, DocumentHighlight, DocumentHighlightKind, Hover, Location, Position, Range,
    SymbolInformation
} from 'vscode-languageserver';

import { UCLexer } from './antlr/generated/UCLexer';
import { UCDocument } from './document';
import { DocumentCodeActionsBuilder } from './documentCodeActionsBuilder';
import { getDocumentByURI, getIndexedReferences } from './indexer';
import { isFieldSymbol, ISymbol, IWithReference, UCStructSymbol, UCSymbol } from './Symbols';

export const VALID_ID_REGEXP = RegExp(/^([a-zA-Z_][a-zA-Z_0-9]*)$/);

export function rangeFromBound(token: Token): Range {
    const length = token.stopIndex - token.startIndex + 1;
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
    const length = stopToken.stopIndex - stopToken.startIndex + 1;
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
    const length = ctx.stop!.stopIndex - ctx.stop!.startIndex + 1;
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
        return position.character >= range.start.character && position.character <= range.end.character;
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
        && position.character <= range.end.character;
}

export function getDocumentSymbol(document: UCDocument, position: Position): ISymbol | undefined {
    const symbols = document.getSymbols();
    for (const symbol of symbols) {
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
export function getDocumentContext(document: UCDocument, position: Position): ISymbol | undefined {
    const symbols = document.getSymbols();
    for (const symbol of symbols) {
        if (isFieldSymbol(symbol)) {
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

    for (const symbol of contextSymbols) {
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

export function getIntersectingContext(context: ParserRuleContext, position: Position): ParserRuleContext | undefined {
    if (!intersectsWith(rangeFromCtx(context), position)) {
        return undefined;
    }
    if (context.children) for (const child of context.children) {
        if (child instanceof ParserRuleContext) {
            const ctx = getIntersectingContext(child, position);
            if (ctx) {
                return ctx;
            }
        }
    }
    return context;
}

export function getCaretTokenIndexFromStream(stream: TokenStream, position: Position): number {
    let i = 0;
    let token: Token | undefined = undefined;
    while (i < stream.size && (token = stream.get(i))) {
        if (position.line === token.line - 1
            && position.character >= token.charPositionInLine
            && position.character < token.charPositionInLine + (token.stopIndex - token.startIndex + 1)) {
            return token.tokenIndex;
        }
        ++i;
    }
    return 0;
}

export function backtrackFirstToken(stream: TokenStream, startTokenIndex: number): Token | undefined {
    if (startTokenIndex >= stream.size) {
        return undefined;
    }

    let i = startTokenIndex;
    while (--i) {
        const token = stream.get(i);
        if (token.channel !== UCLexer.DEFAULT_TOKEN_CHANNEL) {
            continue;
        }
        return token;
    }
    return undefined;
}

export function backtrackFirstTokenOfType(stream: TokenStream, type: number, startTokenIndex: number): Token | undefined {
    if (startTokenIndex >= stream.size) {
        return undefined;
    }
    let i = startTokenIndex;
    while (--i) {
        const token = stream.get(i);
        if (token.channel !== UCLexer.DEFAULT_TOKEN_CHANNEL) {
            continue;
        }

        if (token.type !== type) {
            return undefined;
        }
        return token;
    }
    return undefined;
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