import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { UCStructSymbol, UCSymbolKind } from './';
import { ModifierFlags } from './ModifierFlags';

export class UCReplicationBlock extends UCStructSymbol {
    override kind = UCSymbolKind.ReplicationBlock;
    override modifiers = ModifierFlags.NoDeclaration;

	// Just return the keyword identifier.
	override getTooltip(): string {
		return this.getName().text;
	}

    override index(_document: UCDocument, _context: UCStructSymbol) {
        return;
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitReplicationBlock(this);
	}
}
