import { UCPackage } from './parser';
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
	new UCNativeSymbol('button'),
	new UCNativeSymbol('pointer'),
	new UCNativeSymbol('class'),
	new UCNativeSymbol('map'),
	new UCNativeSymbol('array'),
	new UCNativeSymbol('delegate')
];

NATIVE_SYMBOLS.forEach(symbol => {
	CORE_PACKAGE.add(symbol);
});
