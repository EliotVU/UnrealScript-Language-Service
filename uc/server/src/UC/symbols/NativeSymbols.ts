import { UCPackage, UCNativeSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCTypeSymbol } from "./";

export const CORE_PACKAGE = new UCPackage('Core');
export const NativeClass = new UCNativeSymbol('Class');

export const ArrayClass = new UCClassSymbol({ name: 'Array', range: undefined }, undefined);

const LengthProperty = new UCPropertySymbol({ name: 'Length', range: undefined }, undefined);
LengthProperty.type = new UCTypeSymbol({ name: 'int', range: undefined });
ArrayClass.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: 'Insert', range: undefined }, undefined);
ArrayClass.addSymbol(InsertFunction);

const NATIVE_SYMBOLS = [
	new UCNativeSymbol('byte'),
	new UCNativeSymbol('float'),
	new UCNativeSymbol('int'),
	new UCNativeSymbol('string'),
	new UCNativeSymbol('name'),
	new UCNativeSymbol('bool'),
	new UCNativeSymbol('pointer'),
	new UCNativeSymbol('map'),
	NativeClass,
	ArrayClass,
	new UCNativeSymbol('Delegate'),
	new UCNativeSymbol('button')
];

NATIVE_SYMBOLS.forEach(symbol => {
	CORE_PACKAGE.addSymbol(symbol);
});