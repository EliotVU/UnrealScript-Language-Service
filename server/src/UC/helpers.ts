import { ParserRuleContext, Token, TokenStream } from 'antlr4ts';
import { Hover, Location, MarkupKind, Position, Range } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';

import { commentTokensToStrings } from './Parser/TokenStream';
import {
    ISymbol,
    ModifierFlags,
    UCClassSymbol,
    UCObjectSymbol,
    UCStructSymbol,
    UCSymbolKind,
    getContext,
    hasModifiers,
    isArchetypeSymbol,
    isClass,
    isField,
    isStruct,
    supportsRef,
} from './Symbols';
import { UCLexer } from './antlr/generated/UCLexer';
import { UCDocument } from './document';
import { getDocumentById, getDocumentByURI } from './indexer';

export const VALID_ID_REGEXP = RegExp(/^([a-zA-Z_][a-zA-Z_0-9]*)$/);

export function rangeAtStopFromBound(token: Token): Range {
    const length = token.stopIndex - token.startIndex + 1;
    const line = token.line - 1;
    const position: Position = {
        line,
        character: token.charPositionInLine + length
    };

    return {
        start: position,
        end: position
    };
}

export function rangeFromBound(token: Token): Range {
    const length = token.stopIndex - token.startIndex + 1;
    const line = token.line - 1;
    if (length === 0) {
        const position: Position = {
            line,
            character: token.charPositionInLine + length
        };

        return {
            start: position,
            end: position
        };
    }
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

export function positionFromToken(token: Token): Position {
    return {
        line: token.line - 1,
        character: token.charPositionInLine
    };
}

export function positionFromCtxStart(ctx: ParserRuleContext): Position {
    return {
        line: ctx.start.line - 1,
        character: ctx.start.charPositionInLine
    };
}

export function positionFromCtxStop(ctx: ParserRuleContext): Position {
    return {
        line: ctx.stop!.line - 1,
        character: ctx.stop!.charPositionInLine
    };
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

export function areRangesIntersecting(a: Range, b: Range): boolean {
    if (a.end.line < b.start.line || (a.end.line === b.start.line && a.end.character <= b.start.character)) {
        return false;
    }

    if (b.end.line < a.start.line || (b.end.line === a.start.line && b.end.character <= a.start.character)) {
        return false;
    }

    return true;
}

export function getDocumentSymbol(document: UCDocument, position: Position): ISymbol | undefined {
    const symbols = document.enumerateSymbols();
    for (const symbol of symbols) {
        let child = UCObjectSymbol.getSymbolAtPos(symbol, position);
        if (child) {
            return child;
        }

        if (isStruct(symbol) && (child = symbol.getChildSymbolAtPos(position))) {
            return child;
        }
    }

    return undefined;
}

/**
 * Returns the deepest UCStructSymbol that is intersecting with @param position
 **/
export function getDocumentContext(document: UCDocument, position: Position): UCStructSymbol | undefined {
    const symbols = document.enumerateSymbols();
    for (const symbol of symbols) {
        if (isField(symbol)) {
            const child = symbol.getCompletionContext(position);
            if (child) {
                return child;
            }
        }
    }

    return undefined;
}

export async function getDocumentTooltip(document: UCDocument, position: Position): Promise<Hover | undefined> {
    const symbol = getDocumentSymbol(document, position);
    if (!symbol) {
        return undefined;
    }

    const definitionSymbol = resolveSymbolToRef(symbol);
    if (!definitionSymbol) {
        return undefined;
    }

    const tooltip = getSymbolTooltip(definitionSymbol);
    const output = [`\`\`\`unrealscript`, tooltip, `\`\`\``,];
    const documentation = getSymbolDocumentation(definitionSymbol);
    if (documentation) {
        output.push(
            '___',
            documentation.join('\n\n')
        );
    }
    return {
        contents: {
            kind: MarkupKind.Markdown,
            value: output.join('\n')
        },
        range: symbol.id.range
    };
}

// placeholder, we'll use a visitor pattern eventually.
export function getSymbolTooltip(symbol: ISymbol): string | undefined {
    const tooltipText = symbol.getTooltip();
    return tooltipText;
}

export function getSymbolDocumentation(symbol: ISymbol): string[] | undefined {
    const documentation = symbol instanceof UCObjectSymbol && symbol.getDocumentation();
    if (documentation) {
        return commentTokensToStrings(documentation);
    }

    return undefined;
}

/**
 * Returns a location that represents the definition at a given position within the document.
 *
 * If a symbol is found at the position, then the symbol's definition location will be returned instead.
 **/
export function getDocumentDefinition(document: UCDocument, position: Position): Location | undefined {
    const symbol = getDocumentSymbol(document, position);
    if (!symbol) {
        return undefined;
    }

    const symbolRef = resolveSymbolToRef(symbol);
    if (!symbolRef) {
        return undefined;
    }

    const externalDocument = getSymbolDocument(symbolRef);
    return externalDocument?.uri
        ? Location.create(externalDocument.uri, symbolRef.id.range)
        : undefined;
}

export function getSymbolDefinition(uri: DocumentUri, position: Position): ISymbol | undefined {
    const symbol = getSymbol(uri, position);
    return symbol && resolveSymbolToRef(symbol);
}

/**
 * Resolves to the symbol's contained reference if the symbol kind supports it.
 * e.g. A symbol that implements the interface ITypeSymbol.
 */
export function resolveSymbolToRef(symbol: ISymbol): ISymbol | undefined {
    return supportsRef(symbol)
        ? symbol.getRef()
        : symbol;
}

export function getSymbol(uri: DocumentUri, position: Position): ISymbol | undefined {
    const document = getDocumentByURI(uri);
    return document && getDocumentSymbol(document, position);
}

export function getSymbolDocument(symbol: ISymbol): UCDocument | undefined {
    console.assert(typeof symbol !== 'undefined');

    // An archetype's outer in UE3 resides in the package instead of the class, so we have to handle this special case.
    if (isArchetypeSymbol(symbol)) {
        return symbol.document;
    }

    const documentClass = getContext<UCClassSymbol>(symbol, UCSymbolKind.Class);
    const document = documentClass && getDocumentById(documentClass.id.name);
    return document;
}

export function getCaretTokenFromStream(stream: TokenStream, caret: Position): Token | undefined {
    // ANTLR lines begin at 1
    const carretLine = caret.line + 1;
    const carretColumn = caret.character > 0 ? caret.character - 1 : 0;
    let i = 0;
    let token: Token | undefined = undefined;
    while (i < stream.size && (token = stream.get(i))) {
        if (carretLine === token.line
            && token.charPositionInLine <= carretColumn
            && token.charPositionInLine + (token.stopIndex - token.startIndex) >= carretColumn) {
            return token;
        }
        ++i;
    }

    return undefined;
}

export function backtrackFirstToken(stream: TokenStream, index: number): Token | undefined {
    if (index >= stream.size) {
        return undefined;
    }

    let i = index;
    while (--i) {
        const token = stream.get(i);
        if (token.channel !== UCLexer.DEFAULT_TOKEN_CHANNEL) {
            continue;
        }

        return token;
    }

    return undefined;
}

export function backtrackFirstTokenOfType(stream: TokenStream, type: number, index: number): Token | undefined {
    if (index >= stream.size) {
        return undefined;
    }

    let i = index + 1;
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

export function isSymbolDefined(symbol: ISymbol): boolean {
    // Exclude generated symbols
    if (hasModifiers(symbol) && (symbol.modifiers & ModifierFlags.Generated) != 0) {
        return false;
    }

    return true;
}
