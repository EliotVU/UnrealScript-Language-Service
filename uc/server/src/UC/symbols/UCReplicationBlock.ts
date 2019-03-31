import { UCObjectSymbol, UCSymbol, UCClassSymbol } from '.';
import { UCDocument } from '../DocumentListener';

export class UCReplicationBlock extends UCObjectSymbol {
	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol;
	}
}
