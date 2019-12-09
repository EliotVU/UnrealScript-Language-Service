import { CompletionItem, CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { Name, toName } from '../names';

import { ISymbol, UCTypeFlags } from '.';

export class UCKeyword implements ISymbol, CompletionItem {
	kind: CompletionItemKind = CompletionItemKind.Keyword;

	constructor(public name: Name, public label: string = name.toString()) {
	}

	getName(): Name {
		return this.name;
	}

	getHash(): number {
		return this.name.hash;
	}

	getKind(): SymbolKind {
		return SymbolKind.Null;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

	getPath(): string {
		throw new Error('Method not implemented.');
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visit(this);
	}
}

export const ReliableKeyword = new UCKeyword(toName('reliable'));
export const UnreliableKeyword = new UCKeyword(toName('unreliable'));
export const IfKeyword = new UCKeyword(toName('if'));