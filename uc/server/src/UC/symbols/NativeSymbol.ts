import { SymbolKind, CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import { ISymbol } from './ISymbol';

export class UCNativeSymbol implements ISymbol {
	public outer: ISymbol;

	constructor(private name: Name) {
	}

	getName(): string {
		return this.name.toString();
	}

	getId(): Name {
		return this.name;
	}

	getQualifiedName(): string {
		return this.outer.getQualifiedName() + '.' + this.getName();
	}

	getKind(): SymbolKind {
		return SymbolKind.TypeParameter;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Reference;
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	// TODO: implement
	toCompletionItem(_document: UCDocument): CompletionItem {
		return CompletionItem.create(this.getName());
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}
