import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { isClass, UCObjectSymbol, UCStructSymbol, UCSymbolKind } from './';

export class UCReplicationBlock extends UCStructSymbol {
    override kind = UCSymbolKind.ReplicationBlock;

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName().text;
	}

	acceptCompletion(_document: UCDocument, context: UCObjectSymbol): boolean {
		return isClass(context);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitReplicationBlock(this);
	}
}
