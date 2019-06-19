import { SymbolKind, CompletionItemKind, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import { ISymbol } from './ISymbol';

export class UCNativeType implements ISymbol {
	constructor(private name: Name) {
	}

	getId(): Name {
		return this.name;
	}

	getQualifiedName(): string {
		return this.getId().toString();
	}

	getKind(): SymbolKind {
		return SymbolKind.TypeParameter;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Reference;
	}

	getTooltip(): string {
		return "type " + this.getId();
	}

	// TODO: implement
	toCompletionItem(_document: UCDocument): CompletionItem {
		return CompletionItem.create(this.getId().toString());
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}