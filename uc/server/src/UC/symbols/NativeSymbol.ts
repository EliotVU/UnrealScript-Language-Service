import { SymbolKind, CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';
import { SymbolVisitor } from '../SymbolVisitor';

import { ISymbol } from './ISymbol';

export class UCNativeSymbol implements ISymbol {
	public outer: ISymbol;

	constructor(private name: string) {
	}

	getName(): string {
		return this.name;
	}

	getId(): string {
		return this.getName().toLowerCase();
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
		return CompletionItem.create(this.name);
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visit(this);
	}
}
