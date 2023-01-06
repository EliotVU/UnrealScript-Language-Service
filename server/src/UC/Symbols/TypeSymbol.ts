import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { IExpression } from '../expressions';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { indexReference } from '../indexer';
import { Name } from '../name';
import {
    NAME_ARRAY, NAME_BOOL, NAME_BUTTON, NAME_BYTE, NAME_DELEGATE, NAME_FLOAT, NAME_INT, NAME_MAP,
    NAME_NAME, NAME_NONE, NAME_OBJECT, NAME_POINTER, NAME_RANGE, NAME_ROTATOR, NAME_STRING,
    NAME_TYPE, NAME_VECTOR
} from '../names';
import { IStatement } from '../statements';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_IDENTIFIER, DEFAULT_RANGE, Identifier, IntrinsicArray, ISymbol, IWithIndex,
    IWithInnerSymbols, IWithReference, ModifierFlags, ObjectsTable, SymbolReference,
    UCArchetypeSymbol, UCBaseOperatorSymbol, UCClassSymbol, UCConstSymbol, UCEnumMemberSymbol,
    UCEnumSymbol, UCEventSymbol, UCFieldSymbol, UCMethodSymbol, UCParamSymbol, UCPropertySymbol,
    UCScriptStructSymbol, UCStateSymbol, UCStructSymbol
} from './';
import { ContextInfo, INode } from './ISymbol';
import { UCDelegateSymbol } from './MethodSymbol';
import { tryFindClassSymbol, tryFindSymbolInPackage, UCPackage } from './Package';

export const enum UCNodeKind {
    Expression,
    Statement
}

export const enum UCSymbolKind {
    None,
    Type,
    Package,
    Archetype,
    Field,
    ScriptStruct,
    State,
    Class,
    Interface,
    Const,
    Enum,
    EnumTag,
    Property,
    Parameter,
    Local,
    Function,
    Event,
    Delegate,
    Operator,
    ReplicationBlock,
    DefaultPropertiesBlock,
    Statement
}

export enum UCTypeKind {
    /** An unrecognized type */
    Error,
    None,
    Byte, // Also true for an enum member.
    Int, // Also true for a pointer
    Bool,
    Float,
    Object,
    Name,
    // UC2+
    Delegate,
    // UC3
    Interface,
    Range,
    Struct,
    Vector,
    Rotator,
    String,
    Map,
    Array,
    // <= UC2
    Pointer,
    // == UC2
    Button
}

export interface ITypeSymbol extends ISymbol, IWithReference, IWithInnerSymbols, IWithIndex {
    getTypeText(): string;
    getTypeKind(): UCTypeKind;
    getSymbolAtPos(position: Position): ISymbol | undefined;
}

export function isTypeSymbol(symbol: ISymbol): symbol is ITypeSymbol {
    return symbol.kind === UCSymbolKind.Type;
}

export class UCTypeSymbol implements ITypeSymbol {
    readonly kind: UCSymbolKind = UCSymbolKind.Type;
    readonly id = DEFAULT_IDENTIFIER;

    declare outer: undefined;
    declare nextInHash: undefined;

    constructor(
        readonly type: UCTypeKind,
        readonly range?: Range
    ) { }

    getName(): Name {
        return TypeKindToName.get(this.type) ?? NAME_NONE;
    }

    getHash(): number {
        throw new Error('Method not implemented.');
    }

    getRange(): Range {
        return this.range ?? DEFAULT_RANGE;
    }

    getPath(): string {
        throw new Error('Method not implemented.');
    }

    getTypeKind(): UCTypeKind {
        return this.type;
    }

    getTooltip(): string {
        return 'type ' + this.getName().text;
    }

    getTypeText(): string {
        return this.getName().text;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (intersectsWithRange(position, this.getRange())) {
            return this;
        }
    }

    index(document: UCDocument, context?: UCStructSymbol): void {
        //
    }

    getRef<T extends ISymbol>(): T | undefined {
        return undefined;
    }

    static getStaticName(): Name {
        return NAME_NONE;
    }

    accept<Result>(visitor: SymbolWalker<Result>): void | Result {
        return visitor.visit(this);
    }
}

export class UCObjectTypeSymbol implements ITypeSymbol {
    readonly kind: UCSymbolKind = UCSymbolKind.Type;
    protected reference?: ISymbol;

    public baseType?: ITypeSymbol;

    constructor(
        readonly id: Identifier,
        private readonly range: Range = id.range,
        private expectedKind?: UCSymbolKind
    ) { }

    getName(): Name {
        return this.id.name;
    }

    getHash(): number {
        throw new Error('Method not implemented.');
    }

    getPath(): string {
        throw new Error('Method not implemented.');
    }

    getRange(): Range {
        return this.range;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (!intersectsWith(this.getRange(), position)) {
            return undefined;
        }

        const symbol = this.getContainedSymbolAtPos(position);
        if (symbol) {
            return symbol;
        }

        if (intersectsWithRange(position, this.id.range)) {
            return this;
        }
    }

    getContainedSymbolAtPos(position: Position) {
        // We don't want to provide hover info when we have no resolved reference.
        if (this.reference && intersectsWithRange(position, this.id.range)) {
            return this;
        }
        return this.baseType?.getSymbolAtPos(position);
    }

    getTooltip(): string {
        return this.reference?.getTooltip() ?? '';
    }

    getTypeText(): string {
        if (this.baseType) {
            return this.getName().text + `<${this.baseType.getTypeText()}>`;
        }
        return this.getName().text;
    }

    getTypeKind() {
        return this.reference?.getTypeKind() ?? UCTypeKind.Error;
    }

    getExpectedKind(): UCSymbolKind {
        return this.expectedKind ?? UCSymbolKind.None;
    }

    setExpectedKind(kind: UCSymbolKind) {
        this.expectedKind = kind;
    }

    // TODO: Deprecate, UnrealScript's too context sensitive --
    // it might be better to inline the particular context lookups
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        // Don't move this below the reference return check,
        // because, we still want to index baseType for Predefined array/delegate types.
        this.baseType?.index(document, context);

        // In some cases where a variable declaration is declaring multiple properties we may already have initialized a reference.
        // e.g. "local float x, y, z;"
        if (this.reference || !context) {
            return;
        }

        const id = this.getName();
        let symbol: ISymbol | undefined;
        switch (this.expectedKind) {
            case UCSymbolKind.Package:
                symbol = ObjectsTable.getSymbol<UCPackage>(id, UCSymbolKind.Package);
                break;

            case UCSymbolKind.Class:
            case UCSymbolKind.Interface:
                symbol = tryFindClassSymbol(id);
                break;

            case UCSymbolKind.Enum:
                symbol = ObjectsTable.getSymbol<UCStructSymbol>(id, UCSymbolKind.Enum);
                break;

            case UCSymbolKind.ScriptStruct:
                // Prioritize parent-inherited structs first
                symbol = context.findSuperSymbol<UCStructSymbol>(id, UCSymbolKind.ScriptStruct)
                    ?? ObjectsTable.getSymbol<UCStructSymbol>(id, UCSymbolKind.ScriptStruct);
                break;

            case UCSymbolKind.State:
                symbol = context.findSuperSymbol<UCStructSymbol>(id, UCSymbolKind.State);
                break;

            case UCSymbolKind.Delegate: {
                // The actual 'delegate' type will be verified during the analysis.
                // When qualified, we don't want to match an inherited delegate.
                if (info && info.isQualified) {
                    symbol = context.getSymbol<UCDelegateSymbol>(id, UCSymbolKind.Delegate);
                } else {
                    symbol = document.class?.findSuperSymbol<UCDelegateSymbol>(id, UCSymbolKind.Delegate);
                }
                break;
            }

            // Either a class, struct, or enum
            case UCSymbolKind.Field: {
                symbol = tryFindClassSymbol(id) ?? ObjectsTable.getSymbol(id);
                break;
            }

            default:
                if (isStruct(context)) {
                    symbol = context.findSuperSymbol(id);
                } else if (context as unknown instanceof UCPackage) {
                    symbol = tryFindSymbolInPackage(id, context);
                }
                break;
        }
        symbol && this.setRef(symbol, document);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitObjectType(this);
    }

    setRef(symbol: ISymbol, document: UCDocument, range?: Range): SymbolReference {
        this.reference = symbol;
        return indexReference(symbol, document, Location.create(document.uri, range ?? this.id.range));
    }

    setRefNoIndex(symbol?: ISymbol): void {
        this.reference = symbol;
    }

    getRef<T extends ISymbol>(): T | undefined {
        return this.reference as T | undefined;
    }
}

export class UCArrayTypeSymbol extends UCObjectTypeSymbol {
    override reference = IntrinsicArray;

    static is(symbol: ISymbol): symbol is UCArrayTypeSymbol {
        return symbol.getTypeKind() === UCTypeKind.Array;
    }

    override getTooltip(): string {
        return 'type Array';
    }

    override getTypeKind(): UCTypeKind {
        return UCTypeKind.Array;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitArrayType(this);
    }
}

export class UCDelegateTypeSymbol extends UCObjectTypeSymbol {
    override reference = StaticDelegateType;

    override getTooltip(): string {
        return 'type Delegate';
    }

    override getTypeKind(): UCTypeKind {
        return UCTypeKind.Delegate;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitDelegateType(this);
    }
}

export class UCMetaTypeSymbol extends UCObjectTypeSymbol {
    override getTooltip(): string {
        return 'type<T>';
    }
}

export class UCMapTypeSymbol extends UCObjectTypeSymbol {
    override reference = StaticMapType;

    override getTooltip(): string {
        return 'type Map';
    }

    override getTypeKind(): UCTypeKind {
        return UCTypeKind.Map;
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitMapType(this);
    }
}

/**
 * Represents a qualified identifier type reference such as "extends Core.Object",
 * -- where "Core" is assigned to @left and "Object" to @type.
 */
export class UCQualifiedTypeSymbol implements ITypeSymbol {
    readonly kind: UCSymbolKind = UCSymbolKind.Type;
    readonly id: Identifier;

    protected reference?: ISymbol;

    constructor(
        public readonly type: UCObjectTypeSymbol,
        public readonly left?: UCQualifiedTypeSymbol
    ) {
        this.id = type.id;
    }

    static is(symbol: ISymbol): symbol is UCQualifiedTypeSymbol {
        return Object.prototype.hasOwnProperty.call(symbol, 'type');
    }

    getName(): Name {
        return this.id.name;
    }

    getHash(): number {
        throw new Error('Method not implemented.');
    }

    getRange(): Range {
        return this.id.range;
    }

    getPath(): string {
        throw new Error('Method not implemented.');
    }

    getTypeText(): string {
        return this.type.getTypeText();
    }

    getTypeKind(): UCTypeKind {
        return this.type.getTypeKind();
    }

    getRef<T extends ISymbol>(): T | undefined {
        return this.type.getRef<T>();
    }

    getTooltip(): string {
        return this.type.getTooltip();
    }

    getSymbolAtPos(position: Position) {
        return this.getContainedSymbolAtPos(position);
    }

    getContainedSymbolAtPos(position: Position): ISymbol | undefined {
        const symbol = this.left?.getSymbolAtPos(position) ?? this.type.getSymbolAtPos(position);
        return symbol;
    }

    index(document: UCDocument, context: UCStructSymbol) {
        if (this.left) {
            this.left.index(document, context);
            const leftContext = this.left.getRef();
            if (!leftContext) {
                // We don't want to index type in this case, so that we don't match a false positive,
                // -- where say package was not found, but its member is (in another package).
                return;
            }

            // Ensure that context will never be anything but instances of these. e.g. class'PROP.subfield' where PROP is neither a package nor a struct.
            if (isStruct(leftContext) || isPackage(leftContext)) {
                context = leftContext as UCStructSymbol;
            }
            this.type.index(document, context, { isQualified: true });
        } else {
            this.type.index(document, context);
        }

    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitQualifiedType(this);
    }
}

export const StaticByteType = new UCTypeSymbol(UCTypeKind.Byte);
export const StaticIntType = new UCTypeSymbol(UCTypeKind.Int);
export const StaticBoolType = new UCTypeSymbol(UCTypeKind.Bool);
export const StaticFloatType = new UCTypeSymbol(UCTypeKind.Float);
export const StaticNameType = new UCTypeSymbol(UCTypeKind.Name);
export const StaticStringType = new UCTypeSymbol(UCTypeKind.String);
export const StaticPointerType = new UCTypeSymbol(UCTypeKind.Pointer);
export const StaticButtonType = new UCTypeSymbol(UCTypeKind.Button);
export const StaticNoneType = new UCTypeSymbol(UCTypeKind.None);

export const StaticObjectType = new UCObjectTypeSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE }, DEFAULT_RANGE);
export const StaticArrayType = new UCArrayTypeSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });
export const StaticMapType = new UCMapTypeSymbol({ name: NAME_MAP, range: DEFAULT_RANGE });
export const StaticDelegateType = new UCDelegateTypeSymbol({ name: NAME_DELEGATE, range: DEFAULT_RANGE });
export const StaticVectorType = new UCObjectTypeSymbol({ name: NAME_VECTOR, range: DEFAULT_RANGE });
export const StaticRotatorType = new UCObjectTypeSymbol({ name: NAME_ROTATOR, range: DEFAULT_RANGE });
export const StaticRangeType = new UCObjectTypeSymbol({ name: NAME_RANGE, range: DEFAULT_RANGE });
export const StaticMetaType = new UCMetaTypeSymbol({ name: NAME_TYPE, range: DEFAULT_RANGE });

export const CastTypeSymbolMap: Readonly<WeakMap<Name, ITypeSymbol>> = new WeakMap([
    [NAME_BYTE, StaticByteType],
    [NAME_INT, StaticIntType],
    [NAME_BOOL, StaticBoolType],
    [NAME_FLOAT, StaticFloatType],
    [NAME_STRING, StaticStringType],
    [NAME_NAME, StaticNameType],
    // Oddly... conversion to a button is actually valid!
    [NAME_BUTTON, StaticBoolType]
]);

export const TypeKindToName: Readonly<Map<UCTypeKind, Name>> = new Map([
    [UCTypeKind.None, NAME_NONE],
    [UCTypeKind.Byte, NAME_BYTE],
    [UCTypeKind.Int, NAME_INT],
    [UCTypeKind.Bool, NAME_BOOL],
    [UCTypeKind.Float, NAME_FLOAT],
    [UCTypeKind.String, NAME_STRING],
    [UCTypeKind.Name, NAME_NAME],
    // <= UC2
    [UCTypeKind.Pointer, NAME_POINTER],
    // UC2
    [UCTypeKind.Button, NAME_BUTTON],
]);

export function quoteTypeFlags(kind: UCTypeKind): string {
    const type = UCTypeKind[kind];
    if (process.env.NODE_ENV === 'development') {
        if (typeof type === 'undefined') {
            throw new Error(`Unknown type index '${kind}'.`);
        }
    }
    return type.toString();
}

/** No conversion allowed */
const N = 0x00;
/** Conversion is allowed */
const Y = 0x01;
/** Can be converted implicitally */
const A = 0x02;
/** Auto-coerced in a defaultproperties context */
const D = 0x04;

/**
 * e.g.
 *
 * Casting
 * Int(Bool) : [Int][Bool]
 *
 * Assignment
 * Object = None : [Object][None]
 **/
/** @formatter:off */
const TypeConversionFlagsTable: Readonly<{ [key: number]: number[] }> = [
/* From        Error    None    Byte    Int     Bool    Float   Object  Name    Delegate    Interface   Range   Struct  Vector  Rotator String  Map     Array   Pointer
/* To       */
/* Error    */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* None     */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Byte     */[N,       N,      N,      Y | A,  Y,      Y | A,  N,      N,      N,          N,          N,      N,      N,      N,      Y,      N,      N,      N],
/* Int      */[N,       N,      Y | A,  N,      Y,      Y | A,  N,      N,      N,          N,          N,      N,      N,      N,      Y,      N,      N,      N],
/* Bool     */[N,       N,      Y,      Y | D,  N,      Y,      Y,      Y,      N,          Y,          N,      N,      Y,      Y,      Y,      N,      N,      N],
/* Float    */[N,       N,      Y | A,  Y | A,  Y,      N,      N,      N,      N,          N,          N,      N,      N,      N,      Y,      N,      N,      N],
/* Object   */[N,       Y | A,  N,      N,      N,      N,      N,      N,      N,          A,          N,      N,      N,      N,      N,      N,      N,      N],
/* Name     */[N,       Y | A,  N,      N,      N | D,  N,      N,      N,      N,          N,          N,      N,      N,      N,      Y | D,  N,      N,      N],
/* Delegate */[N,       Y | A,  N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Interface*/[N,       Y | A,  N,      N,      N,      N,      Y | A,  N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Range    */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Struct   */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Vector   */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      Y,      Y,      N,      N,      N],
/* Rotator  */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      Y,      N,      Y,      N,      N,      N],
/* String   */[N,       N,      Y,      Y,      Y,      Y,      Y,      Y,      Y,          Y,          N,      N,      Y,      Y,      N,      N,      N,      N],
/* Map      */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Array    */[N,       N,      N,      N,      N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
/* Pointer  */[N,       N,      N,      N | D,  N,      N,      N,      N,      N,          N,          N,      N,      N,      N,      N,      N,      N,      N],
];
/** @formatter:on */

export function getTypeConversionFlags(input: UCTypeKind, dest: UCTypeKind): number {
    return TypeConversionFlagsTable[dest][input];
}

export function getConversionCost(input: ITypeSymbol, dest: ITypeSymbol): number {
    let inputKind = input.getTypeKind();
    if (inputKind === UCTypeKind.Struct) {
        if (input.getName() === NAME_VECTOR) {
            inputKind = UCTypeKind.Vector;
        } else if (input.getName() === NAME_ROTATOR) {
            inputKind = UCTypeKind.Rotator;
        }
    }
    let destKind = dest.getTypeKind();
    if (destKind === UCTypeKind.Struct) {
        if (dest.getName() === NAME_VECTOR) {
            destKind = UCTypeKind.Vector;
        } else if (dest.getName() === NAME_ROTATOR) {
            destKind = UCTypeKind.Rotator;
        }
    }

    if (inputKind === destKind) {
        return 1;
    }

    const flags = getTypeConversionFlags(inputKind, destKind);
    if (flags === N) {
        return -1;
    }
    if (flags & A) {
        return 1;
    }
    return -1;
}

export const enum UCMatchFlags {
    None = 0,
    Coerce = 1 << 0,
    // We have to presume different rules for assignments within a DefaultProperties block.
    // e.g. A boolean type can be assigned to a name as it interpreted as an identifier.
    T3D = 1 << 1,
}

/**
 * (dest) SomeObject = (src) none;
 */
export function typesMatch(input: ITypeSymbol, dest: ITypeSymbol, matchFlags: UCMatchFlags = UCMatchFlags.None): boolean {
    // Ignore types with no reference (Error)
    let inputKind = input.getTypeKind();
    if (inputKind === UCTypeKind.Error) {
        return true;
    }

    let destKind = dest.getTypeKind();
    if (destKind === UCTypeKind.Error) {
        return true;
    }

    if (inputKind === UCTypeKind.Struct) {
        if (input.getName() === NAME_VECTOR) {
            inputKind = UCTypeKind.Vector;
        } else if (input.getName() === NAME_ROTATOR) {
            inputKind = UCTypeKind.Rotator;
        }
    }

    if (destKind === UCTypeKind.Struct) {
        if (dest.getName() === NAME_VECTOR) {
            destKind = UCTypeKind.Vector;
        } else if (dest.getName() === NAME_ROTATOR) {
            destKind = UCTypeKind.Rotator;
        }
    }

    if (inputKind === destKind) {
        // TODO: Return a distinguisable return type
        return true;
    }

    const c = getTypeConversionFlags(inputKind, destKind);
    if (c === N) {
        if (destKind === UCTypeKind.Delegate) {
            return input.getRef()?.kind === UCSymbolKind.Function;
        }
        return false;
    }

    if ((c & D) != 0 && (matchFlags & UCMatchFlags.T3D) != 0) {
        return true;
    }

    // TODO: Class hierarchy
    // TODO: Struct (vector, rotator, range) conversions
    return (c & A) !== 0 || ((matchFlags & UCMatchFlags.Coerce) != 0 && (c & Y) !== 0);
}

/** Resolves a type to its base type if set. e.g. "Class<Actor>" would be resolved to "Actor". */
export function resolveType(type: ITypeSymbol): ITypeSymbol {
    return hasDefinedBaseType(type) ? type.baseType : type;
}

export function hasDefinedBaseType(type: ITypeSymbol & { baseType?: ITypeSymbol | undefined }): type is UCObjectTypeSymbol & { baseType: ITypeSymbol } {
    return typeof type.baseType !== 'undefined';
}

export function isSymbol(symbol: ISymbol): symbol is ISymbol {
    return typeof symbol.kind !== 'undefined';
}

export function isPackage(symbol: ISymbol): symbol is UCPackage {
    return symbol.kind === UCSymbolKind.Package;
}

export function isField(symbol: (ISymbol & { modifiers?: ModifierFlags }) | undefined): symbol is UCFieldSymbol {
    return symbol instanceof UCFieldSymbol;
}

export function isStruct(symbol: ISymbol | undefined): symbol is UCStructSymbol {
    return symbol instanceof UCStructSymbol;
}

export function isConstSymbol(symbol: ISymbol): symbol is UCConstSymbol {
    return symbol.kind === UCSymbolKind.Const;
}

export function isEnumSymbol(symbol: ISymbol): symbol is UCEnumSymbol {
    return symbol.kind === UCSymbolKind.Enum;
}

export function isEnumTagSymbol(symbol: ISymbol): symbol is UCEnumMemberSymbol {
    return symbol.kind === UCSymbolKind.EnumTag;
}

export function isProperty(symbol: ISymbol | undefined): symbol is UCPropertySymbol {
    return symbol instanceof UCPropertySymbol;
}

export function isPropertySymbol(symbol: ISymbol): symbol is UCPropertySymbol {
    return symbol.kind === UCSymbolKind.Property;
}

export function isParamSymbol(symbol: ISymbol): symbol is UCParamSymbol {
    return symbol.kind === UCSymbolKind.Parameter;
}

export function isLocalSymbol(symbol: ISymbol): symbol is UCParamSymbol {
    return symbol.kind === UCSymbolKind.Local;
}

export function isScriptStructSymbol(symbol: ISymbol): symbol is UCScriptStructSymbol {
    return symbol.kind === UCSymbolKind.ScriptStruct;
}

export function isFunction(symbol: ISymbol | undefined): symbol is UCMethodSymbol {
    return symbol instanceof UCMethodSymbol;
}

export function isMethodSymbol(symbol: ISymbol): symbol is UCMethodSymbol {
    return symbol.kind === UCSymbolKind.Function;
}

export function isDelegateSymbol(symbol: ISymbol): symbol is UCMethodSymbol {
    return symbol.kind === UCSymbolKind.Delegate;
}

export function isEventSymbol(symbol: ISymbol): symbol is UCEventSymbol {
    return symbol.kind === UCSymbolKind.Event;
}

/** Also true of PreOperator and PostOperator symbols */
export function isOperator(symbol: ISymbol): symbol is UCBaseOperatorSymbol {
    return symbol.kind === UCSymbolKind.Operator;
}

export function isStateSymbol(symbol: ISymbol): symbol is UCStateSymbol {
    return symbol.kind === UCSymbolKind.State;
}

export function isClass(symbol: ISymbol | undefined): symbol is UCClassSymbol {
    return symbol instanceof UCClassSymbol;
}

export function isArchetypeSymbol(symbol: ISymbol): symbol is UCArchetypeSymbol {
    return symbol.kind === UCSymbolKind.Archetype;
}

export function isStatement(symbol: INode): symbol is IStatement {
    return symbol.kind === UCNodeKind.Statement;
}

export function isExpression(symbol: INode): symbol is IExpression {
    return symbol.kind === UCNodeKind.Expression;
}