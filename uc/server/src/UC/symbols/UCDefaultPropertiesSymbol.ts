import { UCObjectSymbol, UCSymbol } from '.';

export class UCDefaultPropertiesSymbol extends UCObjectSymbol {
	acceptCompletion(context: UCSymbol): boolean {
		return false;
	}
}
