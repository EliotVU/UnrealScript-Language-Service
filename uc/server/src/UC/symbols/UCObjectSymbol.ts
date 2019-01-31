import { UCStructSymbol } from './UCStructSymbol';

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	getTooltip(): string {
		return this.getName();
	}
}