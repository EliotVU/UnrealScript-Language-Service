import { UCObjectSymbol, UCSymbol } from '.';
import { UCDocument } from '../DocumentListener';

export class UCDefaultPropertiesSymbol extends UCObjectSymbol {
	acceptCompletion(_document: UCDocument, _context: UCSymbol): boolean {
		return false;
	}
}
