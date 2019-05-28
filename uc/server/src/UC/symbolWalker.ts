import {
	ISymbol,
	UCClassSymbol,
	UCEnumSymbol, UCEnumMemberSymbol,
	UCStructSymbol,
	UCConstSymbol,
	UCPropertySymbol, UCLocalSymbol, UCParamSymbol,
	UCMethodSymbol,
	UCStateSymbol,
} from './Symbols';

export abstract class SymbolWalker<T> {
	abstract visit(symbol: ISymbol): T;
	abstract visitStruct(symbol: UCStructSymbol): T;
	abstract visitClass(symbol: UCClassSymbol): T;
	abstract visitMethod(symbol: UCMethodSymbol): T;
	abstract visitProperty(symbol: UCPropertySymbol): T;
	abstract visitLocal(symbol: UCLocalSymbol): T;
	abstract visitParameter(symbol: UCParamSymbol): T;
	abstract visitConst(symbol: UCConstSymbol): T;
	abstract visitEnum(symbol: UCEnumSymbol): T;
	abstract visitEnumMember(symbol: UCEnumMemberSymbol): T;
	abstract visitState(symbol: UCStateSymbol): T;
}