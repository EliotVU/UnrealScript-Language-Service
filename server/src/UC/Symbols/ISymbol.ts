import { Location, Position, Range } from 'vscode-languageserver-types';

import { typeKindToDisplayString } from '../diagnostics/diagnostic';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { ITypeSymbol, UCNodeKind, UCSymbolKind, UCTypeKind } from './';

export type Identifier = Readonly<{
    readonly name: Name;
    readonly range: Range;
}>;

export interface IRange {
    /**
     * Encompassing range of the node in a document.
     *
     * TODO: Flatten and simplify boundaries.
     **/
    readonly range: Range;
}

export interface INode extends IRange {
    readonly kind: UCNodeKind;
}

export interface ISymbol extends IRange {
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
    isQualified?: boolean;
};

export enum SymbolReferenceFlags {
    None,

    // Reference is in an assignment operator or is passed as an argument to a parameter that is marked as 'out'
    Assignment = 1 << 0,

    // The symbol reference is made by the declaration e.g. `class MyClassSymbol extends Foo;`
    Declaration = 1 << 1,

    Override = 1 << 2,

    All = 0xFFFFFFFF
}

export type SymbolReference = {
    /**
     * The location where a symbol is being referenced.
     * This symbol is mapped by a qualifiedId as key by a map that's holding an object of this interface.
     */
    location: Location;

    /**
     * Various flags to tell more precisely why this reference is made.
     */
    flags: SymbolReferenceFlags;
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

/**
 * Returns the outer of a symbol that matches the kind.
 *
 * Be careful when using it against a context symbol to get a ClassSymbol e.g.
 * ```typescript
 * getOuter<UCSymbolClass>(MyContextSymbolThatMightBeAClassSymbol, UCSymbolKind.Class)
 * ```
 * will return `undefined` if the symbol is of type UCSymbolClass, if undesired, use `getContext` instead.
 *
 * @param symbol the symbol to check against.
 * @param kind the kind to check against.
 * @returns the outer.
 **/
export function getOuter<T extends ISymbol = ISymbol>(symbol: ISymbol, kind: UCSymbolKind): T | undefined {
    let outer: ISymbol | undefined;
    for (
        outer = symbol.outer;
        outer && outer.kind !== kind;
        outer = outer.outer
    );

    return outer as T;
}

/**
 * Returns the symbol or outer of a symbol that matches the kind.
 *
 * The context is determined by the symbol's outer just like `getOuter` but assumes that the passed symbol may also be desired as a result.
 *
 * @param symbol the symbol to check against.
 * @param kind the kind to check against.
 * @returns the symbol or outer.
 **/
export function getContext<T extends ISymbol = ISymbol>(symbol: ISymbol, kind: UCSymbolKind): T | undefined {
    return symbol.kind == kind ? symbol as T : getOuter<T>(symbol, kind);
}

/**
 * Checks if both symbols have a matching identity (the hash).
 *
 * Useful to compare against intrinsic classes that also may have an UnrealScript counter part, such as the UObject.
 *
 * @returns true if both have an identical reference, or if both have a matching identity (the hash)
 */
export function areIdentityMatch(symbol: ISymbol, other: ISymbol): boolean {
    return symbol === other || symbol.getHash() === other.getHash();
}

export function hasNoKind(symbol: { kind: UCNodeKind }): boolean {
    return typeof symbol.kind === 'undefined';
}

export function getSymbolDebugInfo(symbol?: ISymbol): string {
    if (typeof symbol === 'undefined') {
        return 'null';
    }

    const range = symbol.range;
    const path = symbol.getName().text;
    return `(${range.start.line + 1}:${range.start.character} - ${range.end.line + 1}:${range.end.character}) [${path}]: ${typeKindToDisplayString(symbol.getTypeKind())}`;
}
