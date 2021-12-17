import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_ENUMCOUNT } from '../names';
import { SymbolWalker } from '../symbolWalker';
import { ISymbol, UCEnumMemberSymbol, UCFieldSymbol, UCStructSymbol, UCTypeFlags } from './';

export class UCEnumSymbol extends UCStructSymbol {
    /** Excludes E_MAX */
    public maxValue: number;

    public enumCountMember: UCEnumMemberSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getTypeFlags() {
		return UCTypeFlags.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getPath()}`;
	}

	getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: string, _kind?: UCTypeFlags): C[] {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}
        symbols.push(this.enumCountMember);
		return symbols as C[];
	}

    getSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCTypeFlags): T | undefined {
        if (id === NAME_ENUMCOUNT) {
            return this.enumCountMember as unknown as T;
        }
        return super.getSymbol(id, kind);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitEnum(this);
	}
}