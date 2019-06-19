import { CompletionItem, CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name, toName } from '../names';

import { ISymbol } from '.';

export class UCKeyword implements ISymbol, CompletionItem {
	kind: CompletionItemKind = CompletionItemKind.Keyword;

	constructor(public name: Name, public label: string = name.toString()) {
	}

	getId(): Name {
		return this.name;
	}

	getKind(): SymbolKind {
		return this.kind;
	}

	getQualifiedName(): string {
		throw new Error('Method not implemented.');
	}

	getTooltip(): string {
		throw new Error('Method not implemented.');
	}

	toCompletionItem(_document: UCDocument): CompletionItem {
		return this;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}

export const ReliableKeyword = new UCKeyword(toName('reliable'));
export const UnreliableKeyword = new UCKeyword(toName('unreliable'));