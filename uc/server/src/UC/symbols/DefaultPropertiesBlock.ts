import { UCDocument } from '../document';
import { UCObjectSymbol, UCSymbol, UCClassSymbol, UCScriptStructSymbol } from '.';

export class UCDefaultPropertiesBlock extends UCObjectSymbol {
	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol || context instanceof UCScriptStructSymbol;
	}
}
