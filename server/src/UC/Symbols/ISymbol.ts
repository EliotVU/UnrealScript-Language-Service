import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { ITypeSymbol, UCNodeKind, UCStructSymbol, UCSymbolKind, UCTypeKind } from './';

export type Identifier = Readonly<{
    readonly name: Name;
    readonly range: Range;
}>;

export interface INode {
    readonly kind: UCNodeKind;
}

export interface ISymbol {
    readonly kind: UCSymbolKind;
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

    getRange(): Range;
    /**
     * Returns a path presented in a qualified identifier format.
     * e.g. "Core.Object.Outer".
     **/
    getPath(): string;
    getTooltip(): string;

    /**
     * Returns an internal representation of a UnrealScript type.
     * e.g. this let's expose @UCEnumMemberSymbol as a byte type etc.
     **/
    getTypeKind(): UCTypeKind;

    accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export interface ISymbolContainer<T extends ISymbol> {
    addSymbol(symbol: T): number | undefined;
    getSymbol(id: Name | number, kind?: UCSymbolKind, outer?: ISymbol): T | undefined;
}

export type ContextInfo = {
    contextType?: ITypeSymbol;
    inAssignment?: boolean;
    isOptional?: boolean;
    hasArguments?: boolean;
    isQualified?: boolean;
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

export interface IWithInnerSymbols {
    getSymbolAtPos(position: Position): ISymbol | undefined;
}

export interface IWithIndex {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo): void;
}

export function getOuter<T extends ISymbol = ISymbol>(symbol: ISymbol, kind: UCSymbolKind): T | undefined {
    let outer: ISymbol | undefined;
    for (
        outer = symbol.outer;
        outer && outer.kind !== kind;
        outer = outer.outer
    );
    return outer as T | undefined;
}

export function hasNoKind(symbol: { kind: UCNodeKind }): boolean {
    return typeof symbol.kind === 'undefined';
}

export function getDebugSymbolInfo(symbol?: ISymbol): string {
    if (typeof symbol === 'undefined') {
        return 'null';
    }

    const range = symbol.getRange();
    const path = symbol.getName().text;
    return `(${range.start.line + 1}:${range.start.character} - ${range.end.line + 1}:${range.end.character}) [${path}]`;
}