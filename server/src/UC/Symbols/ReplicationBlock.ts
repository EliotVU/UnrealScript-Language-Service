import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { isClass, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './';

export class UCReplicationBlock extends UCStructSymbol {
    override kind = UCSymbolKind.ReplicationBlock;

	// Just return the keyword identifier.
	override getTooltip(): string {
		return this.getName().text;
	}

	override acceptCompletion(_document: UCDocument, context: UCObjectSymbol): boolean {
		return isClass(context);
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitReplicationBlock(this);
	}
}
