import { SymbolKind, CompletionItemKind } from 'vscode-languageserver-types';

import { UCFieldSymbol } from ".";
import { SymbolVisitor } from '../SymbolVisitor';

export class UCConstSymbol extends UCFieldSymbol {
	public value: string;

	isProtected(): boolean {
		return true;
	}

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		return 'const ' + this.getQualifiedName() + ' = ' + this.value;
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitConst(this);
	}
}
