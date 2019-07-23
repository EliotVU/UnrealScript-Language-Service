import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { ParserRuleContext, CommonTokenStream } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';

import { UCGrammarParser } from '../../antlr/UCGrammarParser';

import { UCDocument } from "../document";
import { SymbolWalker } from '../symbolWalker';
import { intersectsWithRange } from '../helpers';
import { Name } from '../names';
import { DocumentASTWalker } from '../documentASTWalker';

import { ISymbol, Identifier, UCStructSymbol } from ".";

export const COMMENT_TYPES = new Set([UCGrammarParser.LINE_COMMENT, UCGrammarParser.BLOCK_COMMENT]);

export const NO_NAME = '';

export const DEFAULT_POSITION = Position.create(0, 0);
export const DEFAULT_RANGE = Range.create(DEFAULT_POSITION, DEFAULT_POSITION);

/**
 * A symbol build from a AST context.
 */
export abstract class UCSymbol implements ISymbol {
	public outer?: ISymbol;
	public context?: ParserRuleContext;

	constructor(public readonly id: Identifier) {

	}

	/**
	 * Returns the whole range this symbol encompasses i.e. for a struct this should be inclusive of the entire block.
	 */
	getRange(): Range {
		return this.id.range;
	}

	getId(): Name {
		return this.id.name;
	}

	getQualifiedName(): string {
		let text = this.getId().toString();
		for (var outer = this.outer; outer; outer = outer.outer) {
			text = outer.getId() + '.' + text;
		}
		return text;
	}

	getKind(): SymbolKind {
		return SymbolKind.Field;
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Text;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		return intersectsWithRange(position, this.getRange()) && this.getContainedSymbolAtPos(position) || this;
	}

	protected getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
		return undefined;
	}

	getCompletionSymbols(_document: UCDocument): ISymbol[] {
		return [];
	}

	acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		return true;
	}

	index(_document: UCDocument, _context: UCStructSymbol) {}

	getUri(): string {
		return this.outer instanceof UCSymbol && this.outer.getUri() || '';
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

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(
			this.getId().toString(), this.getKind(),
			this.getRange(), undefined,
			this.outer && this.outer.getId().toString()
		);
	}

	toCompletionItem(_document: UCDocument): CompletionItem {
		const item = CompletionItem.create(this.getId().toString());
		item.detail = this.getTooltip();
		item.kind = this.getCompletionItemKind();
		item.data = this.getQualifiedName();
		return item;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}

	walk(_visitor: DocumentASTWalker, _ctx: ParseTree) {
	}
}