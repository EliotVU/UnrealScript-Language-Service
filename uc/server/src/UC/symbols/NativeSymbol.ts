import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';

import { ISymbol } from './ISymbol';
import { SymbolVisitor } from '../SymbolVisitor';

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
	toCompletionItem(_document: UCDocument) {
		return undefined;
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visit(this);
	}
}
