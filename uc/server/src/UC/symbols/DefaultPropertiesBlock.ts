import { UCObjectSymbol, UCSymbol, UCClassSymbol, UCScriptStructSymbol } from '.';
import { UCDocument } from '../DocumentListener';

export class UCDefaultPropertiesBlock extends UCObjectSymbol {
	acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return context instanceof UCClassSymbol || context instanceof UCScriptStructSymbol;
	}
}
