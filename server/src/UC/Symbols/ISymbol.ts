import { SymbolKind, Location, CompletionItem, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import { UCTypeFlags } from '.';

export interface ISymbol {
	outer?: ISymbol;

	getId(): Name;
	getHash(): number;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getTooltip(): string;

	toCompletionItem(document: UCDocument): CompletionItem;

	accept<Result>(visitor: SymbolWalker<Result>): Result;
}

export interface ISymbolContainer<T extends ISymbol> {
	addSymbol(symbol: T): Name | undefined;
	addAlias(id: Name, symbol: T): void;
	getSymbol(id: Name, kind?: SymbolKind): T | undefined;
}

export interface IContextInfo {
	type?: UCTypeFlags;
	inAssignment?: boolean;
	isOptional?: boolean;
	hasArguments?: boolean;
}

export interface ISymbolReference {
	/**
	 * The location where a symbol is being referenced.
	 * This symbol is mapped by a qualifiedId as key by a map that's holding an object of this interface.
	 */
	location: Location;

	// Context was referred by an assignment operator.
	inAssignment?: boolean;
}

export interface IWithReference extends ISymbol {
	getReference(): ISymbol | undefined;
}

export interface Identifier {
	readonly name: Name;
	readonly range: Range;
}