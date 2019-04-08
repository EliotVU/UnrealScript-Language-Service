import { ISymbol } from '.';

export interface ISymbolContainer<T> {
	addSymbol(symbol: T): void;
	getSymbol(id: string): ISymbol;
}
