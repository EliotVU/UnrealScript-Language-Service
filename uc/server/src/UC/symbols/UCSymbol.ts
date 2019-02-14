import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Location, Position } from 'vscode-languageserver-types';

import { ISymbol } from './ISymbol';
import { ISymbolId } from "./ISymbolId";
import { UCStructSymbol, UCPackage } from "./";
import { UCDocumentListener } from "../DocumentListener";
import { ParserRuleContext, CommonTokenStream } from 'antlr4ts';
import { UCGrammarParser } from '../../antlr/UCGrammarParser';

export const COMMENT_TYPES = new Set([UCGrammarParser.LINE_COMMENT, UCGrammarParser.BLOCK_COMMENT]);

/**
 * A symbol that resides in a document, holding an id and range.
 */
export abstract class UCSymbol implements ISymbol {
	public outer?: ISymbol;

	/** Locations that reference this symbol. */
	private links?: Location[];

	public context?: ParserRuleContext;

	constructor(private id: ISymbolId) {
	}

	getTypeTooltip(): string {
		return undefined;
	}

	getTooltip(): string | undefined {
		return this.getName();
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
		return this.id.name || '';
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

	getSpanRange(): Range {
		return this.id.range;
	}

	getRange(): Range {
		return this.id.range;
	}

	protected isIdWithinPosition(position: Position): boolean {
		var range = this.id.range;
		var isInRange = position.line >= range.start.line && position.line <= range.end.line
			&& position.character >= range.start.character && position.character < range.end.character;
		return isInRange;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isIdWithinPosition(position)) {
			const symbol = this.getSubSymbolAtPos(position);
			return symbol || this;
		}
		return undefined;
	}

	protected getSubSymbolAtPos(_position: Position): UCSymbol |  undefined {
		return undefined;
	}

	link(_document: UCDocumentListener, _context: UCStructSymbol = _document.class) {
	}

	analyze(_document: UCDocumentListener, _context: UCStructSymbol) {

	}

	registerReference(location: Location) {
		if (!this.links) {
			this.links = [];
		}
		this.links.push(location);
	}

	getReferencedLocations(): Location[] | undefined {
		return this.links;
	}

	getUri(): string {
		return this.outer.getUri();
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(this.getName(), this.getKind(), this.getSpanRange(), undefined, this.outer.getName());
	}

	toCompletionItem(document: UCDocumentListener): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.documentation = this.getDocumentation(document.tokenStream);
		item.kind = this.getCompletionItemKind();
		return item;
	}

	findTypeSymbol(id: string, deepSearch: boolean): ISymbol | undefined {
		if (this.outer instanceof UCSymbol) {
			return this.outer.findTypeSymbol(id, deepSearch);
		} else if (this.outer instanceof UCPackage) {
			return this.outer.findQualifiedSymbol(id, deepSearch);
		}
		return undefined;
	}
}
