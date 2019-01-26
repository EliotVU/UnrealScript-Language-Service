import { UCPackage } from "./UCPackage";
import { UCNativeSymbol } from "./UCNativeSymbol";

export const CORE_PACKAGE = new UCPackage('Core');

export const NATIVE_PACKAGES = [
	CORE_PACKAGE
];

export const NATIVE_SYMBOLS = [
	new UCNativeSymbol('byte'),
	new UCNativeSymbol('float'),
	new UCNativeSymbol('int'),
	new UCNativeSymbol('string'),
	new UCNativeSymbol('name'),
	new UCNativeSymbol('bool'),
	new UCNativeSymbol('pointer'),
	new UCNativeSymbol('map'),
	new UCNativeSymbol('Class'),
	new UCNativeSymbol('Array'),
	new UCNativeSymbol('Delegate'),
	new UCNativeSymbol('button')
];

NATIVE_SYMBOLS.forEach(symbol => {
	CORE_PACKAGE.addSymbol(symbol);
});
