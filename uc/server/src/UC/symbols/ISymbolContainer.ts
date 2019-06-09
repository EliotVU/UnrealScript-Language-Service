import { Name } from '../names';

import { ISymbol } from '.';

export interface ISymbolContainer<T> {
	addSymbol(symbol: T): Name | undefined;
	getSymbol(id: Name): ISymbol | undefined;
}
