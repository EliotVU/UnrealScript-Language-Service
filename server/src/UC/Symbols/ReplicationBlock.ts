import { SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { UCClassSymbol, UCStructSymbol, UCSymbol, UCTypeFlags } from './';

export class UCReplicationBlock extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Constructor;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

	// Just return the keyword identifier.
	getTooltip(): string {
		return this.getName().toString();
	}

	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitReplicationBlock(this);
	}
}
