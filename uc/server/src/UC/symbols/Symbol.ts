import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver-types';
import { ParserRuleContext, CommonTokenStream } from 'antlr4ts';

import { UCDocument, addIndexedReference } from "../DocumentListener";
import { UCGrammarParser } from '../../antlr/UCGrammarParser';

import { ISymbol, ISymbolReference } from './ISymbol';
import { UCStructSymbol, UCPackage } from ".";
import { SymbolVisitor } from '../SymbolVisitor';

export const COMMENT_TYPES = new Set([UCGrammarParser.LINE_COMMENT, UCGrammarParser.BLOCK_COMMENT]);

export const NO_NAME = '';

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

	getTooltip(): string | undefined {
		return this.getQualifiedName();
	}

	getDocumentation(tokenStream: CommonTokenStream): string | undefined {
		if (!this.context) {
			return undefined;
		}

		const leadingComment = tokenStream
			.getHiddenTokensToRight(this.context.stop.tokenIndex)
			.filter(token => COMMENT_TYPES.has(token.type) && token.charPositionInLine !== 0);

		if (leadingComment && leadingComment.length > 0) {
			return leadingComment.shift().text;
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

	getSymbolAtPos(position: Position): UCSymbol {
		return this.intersectsWithName(position) && this.getContainedSymbolAtPos(position) || this;
	}

	protected getContainedSymbolAtPos(_position: Position): UCSymbol {
		return undefined;
	}

	getOuter<T extends ISymbol>(): ISymbol {
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

	index(_document: UCDocument, _context: UCStructSymbol) {};
	analyze(_document: UCDocument, _context: UCStructSymbol) {};

	indexReference(document: UCDocument, ref: ISymbolReference) {
		const qualifiedId = this.getQualifiedName();

		const refs = document.indexReferencesMade.get(qualifiedId) || new Set<ISymbolReference>();
		refs.add(ref);

		document.indexReferencesMade.set(qualifiedId, refs);

		// TODO: Refactor this, we are pretty much duplicating this function's job.
		addIndexedReference(qualifiedId, ref);
	}

	getUri(): string | undefined {
		return this.outer instanceof UCSymbol && this.outer.getUri();
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(
			this.getName(), this.getKind(),
			this.getSpanRange(), undefined,
			this.outer.getName()
		);
	}

	toCompletionItem(_document: UCDocument): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.kind = this.getCompletionItemKind();
		item.data = this.getQualifiedName();
		return item;
	}

	findTypeSymbol(id: string, deepSearch: boolean): ISymbol {
		if (this.outer instanceof UCSymbol) {
			return this.outer.findTypeSymbol(id, deepSearch);
		} else if (this.outer instanceof UCPackage) {
			return this.outer.findSymbol(id, deepSearch);
		}
		return undefined;
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visit(this);
	}
}
