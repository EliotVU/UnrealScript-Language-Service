import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver-types';
import { ParserRuleContext, CommonTokenStream } from 'antlr4ts';

import { UCDocument } from "../DocumentListener";
import { UCGrammarParser } from '../../antlr/UCGrammarParser';

import { ISymbol } from './ISymbol';
import { UCStructSymbol } from ".";
import { SymbolWalker } from '../symbolWalker';

export const COMMENT_TYPES = new Set([UCGrammarParser.LINE_COMMENT, UCGrammarParser.BLOCK_COMMENT]);

export const NO_NAME = '';

export const DEFAULT_POSITION = Position.create(0, 0);
export const DEFAULT_RANGE = Range.create(DEFAULT_POSITION, DEFAULT_POSITION);

/**
 * A symbol that resides in a document, holding an id and range.
 */
export abstract class UCSymbol implements ISymbol {
	public outer?: ISymbol;
	public context?: ParserRuleContext;

	constructor(private nameRange: Range) {
	}

	getTypeTooltip(): string | undefined {
		return undefined;
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getDocumentation(tokenStream: CommonTokenStream): string | undefined {
		if (!this.context) {
			return undefined;
		}

		const leadingComment = tokenStream
			.getHiddenTokensToRight(this.context.stop!.tokenIndex)
			.filter(token => COMMENT_TYPES.has(token.type) && token.charPositionInLine !== 0);

		if (leadingComment && leadingComment.length > 0) {
			return leadingComment.shift()!.text;
		}

		const headerComment = tokenStream
			.getHiddenTokensToLeft(this.context.start.tokenIndex)
			.filter(token => COMMENT_TYPES.has(token.type) && token.charPositionInLine === 0);

		if (headerComment && headerComment.length > 0) {
			return headerComment.map(comment => comment.text).join('\n');
		}
		return undefined;
	}

	getName(): string {
		return NO_NAME;
	}

	getId(): string {
		return this.getName().toLowerCase();
	}

	getQualifiedName(): string {
		if (this.outer) {
			return this.outer.getQualifiedName() + '.' + this.getName();
		}
		return this.getName();
	}

	getKind(): SymbolKind {
		return SymbolKind.Field;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Text;
	}

	getNameRange(): Range {
		return this.nameRange;
	}

	getSpanRange(): Range {
		return this.nameRange;
	}

	protected intersectsWithName(position: Position): boolean {
		var range = this.getNameRange();
		return position.line >= range.start.line && position.line <= range.end.line
			&& position.character >= range.start.character && position.character < range.end.character;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		return this.intersectsWithName(position) && this.getContainedSymbolAtPos(position) || this;
	}

	protected getContainedSymbolAtPos(_position: Position): UCSymbol | undefined {
		return undefined;
	}

	getOuter<T extends ISymbol>(): ISymbol | undefined {
		for (let outer = this.outer; outer; outer = outer.outer) {
			if (<T>(outer)) {
				return outer;
			}
		}
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return [];
	}

	acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		return true;
	}

	index(_document: UCDocument, _context: UCStructSymbol) {}
	analyze(_document: UCDocument, _context: UCStructSymbol) {}

	getUri(): string {
		return this.outer instanceof UCSymbol && this.outer.getUri() || '';
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(
			this.getName(), this.getKind(),
			this.getSpanRange(), undefined,
			this.outer && this.outer.getName()
		);
	}

	toCompletionItem(_document: UCDocument): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.kind = this.getCompletionItemKind();
		item.data = this.getQualifiedName();
		return item;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}
