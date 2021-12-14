import { Location, Range, SymbolKind } from 'vscode-languageserver-types';

import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { UCTypeFlags } from './';

export interface ISymbol {
    readonly id: Identifier;

	/** Parent symbol, mirroring Unreal Engine's Object class structure. */
	outer?: ISymbol;

	/**
	 * The next symbol in the hash chain.
	 * e.g. consider package "Engine" and the class "Engine.Engine" which resides in package "Engine",
	 * the class would be the @nextInHash of package "Engine".
	 **/
	nextInHash?: ISymbol | undefined;

	getName(): Name;
	getHash(): number;

	/**
	 * Returns a path presented in a qualified identifier format.
	 * e.g. "Core.Object.Outer".
	 **/
	getPath(): string;

	/** Returns the corresponding VS.SymbolKind, for presentation purposes. */
	getKind(): SymbolKind;

	/**
	 * Returns an internal representation of a UnrealScript type.
	 * e.g. this let's expose @UCEnumMemberSymbol as a byte type etc.
	 **/
	getTypeFlags(): UCTypeFlags;

	accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export interface ISymbolContainer<T extends ISymbol> {
	addSymbol(symbol: T): number | undefined;
	getSymbol(id: Name | number, type?: UCTypeFlags, outer?: ISymbol): T | undefined;
}

export type ContextInfo = {
	typeFlags?: UCTypeFlags;
	inAssignment?: boolean;
	isOptional?: boolean;
	hasArguments?: boolean;
};

export type SymbolReference = {
	/**
	 * The location where a symbol is being referenced.
	 * This symbol is mapped by a qualifiedId as key by a map that's holding an object of this interface.
	 */
	location: Location;

	// Context was referred by an assignment operator.
	inAssignment?: boolean;
};

export interface IWithReference {
	getRef<T extends ISymbol>(): T | undefined;
}

export function supportsRef<T>(obj: T & any): obj is T & IWithReference {
    return typeof obj['getRef'] !== 'undefined';
}

export type Identifier = Readonly<{
	readonly name: Name;
	readonly range: Range;
}>;