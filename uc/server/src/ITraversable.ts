import { ISimpleSymbol } from './ISimpleSymbol';

export interface ITraversable extends ISimpleSymbol {
	symbols?: Map<string, ISimpleSymbol>;
	addSymbol(symbol: ISimpleSymbol): void;
	findInheritedSymbol<T>(name: string, deepSearch?: boolean): ISimpleSymbol;
}
