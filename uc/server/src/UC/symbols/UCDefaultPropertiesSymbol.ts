import { UCObjectSymbol, UCSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

export class UCDefaultPropertiesSymbol extends UCObjectSymbol {
	acceptCompletion(_document: UCDocumentListener, _context: UCSymbol): boolean {
		return false;
	}
}
