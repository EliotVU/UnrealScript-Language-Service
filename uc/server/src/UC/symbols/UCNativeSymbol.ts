import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISymbol } from './ISymbol';
import { UCDocument } from '../DocumentListener';

export class UCNativeSymbol implements ISymbol {
	public outer: ISymbol;

	constructor(private name: string) {
	}

	getName(): string {
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
	toCompletionItem(_document: UCDocument) {
		return undefined;
	}
}
