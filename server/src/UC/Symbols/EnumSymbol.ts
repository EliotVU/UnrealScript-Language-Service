

import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_ENUMCOUNT } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextKind, ISymbol, UCEnumMemberSymbol, UCFieldSymbol, UCStructSymbol, UCSymbolKind,
    UCTypeKind
} from './';

export class UCEnumSymbol extends UCStructSymbol {
    override kind = UCSymbolKind.Enum;

    declare public extendsType?: undefined;

    /** Excludes E_MAX */
    public maxValue: number;
    public enumCountMember: UCEnumMemberSymbol;

	override getTypeKind() {
		return UCTypeKind.Byte;
	}

    protected override getTypeKeyword(): string {
		return 'enum';
	}

	override getTooltip(): string {
		return `${this.getTypeKeyword()} ${this.getPath()}`;
	}

	override getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: ContextKind, _kinds?: UCSymbolKind): C[] {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}
        symbols.push(this.enumCountMember);
		return symbols as C[];
	}

    override getSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind): T | undefined {
        if (id === NAME_ENUMCOUNT) {
            return this.enumCountMember as unknown as T;
        }
        return super.getSymbol(id, kind);
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitEnum(this);
	}
}