import { SymbolKind, Location, CompletionItem, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';

export interface ISymbol {
	outer?: ISymbol;
	getName(): string;
	getId(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getTooltip(): string;

	toCompletionItem(document: UCDocument): CompletionItem;

	accept<Result>(visitor: SymbolWalker<Result>): Result;
}

export interface ISymbolContext {
	// Context was referred by an assignment operator.
	inAssignment?: boolean;
}

export interface ISymbolReference {
	/**
	 * The symbol that has made a reference to this location.
	 */
	symbol: ISymbol;

	/**
	 * The location where a symbol is being referenced.
	 * This symbol is mapped by a qualifiedId as key by a map that's holding an object of this interface.
	 */
	location: Location;

	/**
	 * Context that details how this reference was made, e.g by an assignment.
	 */
	context?: ISymbolContext;
}

export interface IWithReference extends ISymbol {
	getReference(): ISymbol | undefined;
}

export interface Identifier {
	readonly name: string;
	readonly range: Range;
}