import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';
import { ISimpleSymbol } from './ISimpleSymbol';

export class UCNativeSymbol implements ISimpleSymbol {
	public outer: ISimpleSymbol;

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
