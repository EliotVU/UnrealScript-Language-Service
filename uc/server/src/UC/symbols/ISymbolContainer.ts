import { ISymbol } from '.';

export interface ISymbolContainer<T> {
	addSymbol(symbol: T): string | undefined;
	getSymbol(id: string): ISymbol | undefined;
}
