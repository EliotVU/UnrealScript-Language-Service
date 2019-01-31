import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISymbol } from './ISymbol';

export class UCNativeSymbol implements ISymbol {
	public outer: ISymbol;

	constructor(private name: string, private uri?: string) {
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

	getUri(): string | undefined {
		return this.uri;
	}

	getTooltip(): string {
		return this.getName();
	}
}
