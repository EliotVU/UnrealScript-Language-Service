import { Location, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { IExpression } from '../expressions';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { config, indexReference } from '../indexer';
import { Name } from '../name';
import {
    NAME_ARCHETYPE,
    NAME_ARRAY,
    NAME_BOOL,
    NAME_BUTTON,
    NAME_BYTE,
    NAME_CLASS,
    NAME_CONST,
    NAME_DEFAULTPROPERTIES,
    NAME_DELEGATE,
    NAME_ENUM,
    NAME_ENUMTAG,
    NAME_ERROR,
    NAME_EVENT,
    NAME_FIELD,
    NAME_FLOAT,
    NAME_FUNCTION,
    NAME_INT,
    NAME_INTERFACE,
    NAME_LOCAL,
    NAME_MACRO,
    NAME_MAP,
    NAME_NAME,
    NAME_NONE,
    NAME_OBJECT,
    NAME_OPERATOR,
    NAME_PACKAGE,
    NAME_PARAMETER,
    NAME_POINTER,
    NAME_PROPERTY,
    NAME_RANGE,
    NAME_REPLICATION,
    NAME_ROTATOR,
    NAME_SCRIPTSTRUCT,
    NAME_STATE,
    NAME_STATEMENT,
    NAME_STRING,
    NAME_STRUCT,
    NAME_TYPE,
    NAME_VECTOR,
} from '../names';
import { UCGeneration } from '../settings';
import { IStatement } from '../statements';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_IDENTIFIER,
    DEFAULT_RANGE,
    IntrinsicArray,
    IntrinsicClass,
    ObjectsTable,
    UCClassSymbol,
    UCFieldSymbol,
    UCMethodSymbol,
    UCPackage,
    UCPropertySymbol,
    UCStructSymbol,
    areIdentityMatch,
    findOuterFieldSymbol,
    tryFindClassSymbol,
    tryFindSymbolInPackage,
    type ContextInfo,
    type INode,
    type ISymbol,
    type IWithInnerSymbols,
    type IWithReference,
    type Identifier,
    type SuperSymbol,
    type SymbolReference,
    type UCArchetypeSymbol,
    type UCBaseOperatorSymbol,
    type UCConstSymbol,
    type UCDelegateSymbol,
    type UCEnumMemberSymbol,
    type UCEnumSymbol,
    type UCEventSymbol,
    type UCInterfaceSymbol,
    type UCParamSymbol,
    type UCScriptStructSymbol,
    type UCStateSymbol
} from './';
import { ModifierFlags } from './ModifierFlags';

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
    Statement,
    Macro
}

export const SymboldKindToName: Readonly<Map<UCSymbolKind, Name>> = new Map([
    [UCSymbolKind.None, NAME_NONE],
    [UCSymbolKind.Type, NAME_TYPE],
    [UCSymbolKind.Package, NAME_PACKAGE],
    [UCSymbolKind.Archetype, NAME_ARCHETYPE],
    [UCSymbolKind.Field, NAME_FIELD],
    [UCSymbolKind.ScriptStruct, NAME_SCRIPTSTRUCT],
    [UCSymbolKind.State, NAME_STATE],
    [UCSymbolKind.Class, NAME_CLASS],
    [UCSymbolKind.Interface, NAME_INTERFACE],
    [UCSymbolKind.Const, NAME_CONST],
    [UCSymbolKind.Enum, NAME_ENUM],
    [UCSymbolKind.EnumTag, NAME_ENUMTAG],
    [UCSymbolKind.Property, NAME_PROPERTY],
    [UCSymbolKind.Parameter, NAME_PARAMETER],
    [UCSymbolKind.Local, NAME_LOCAL],
    [UCSymbolKind.Function, NAME_FUNCTION],
    [UCSymbolKind.Event, NAME_EVENT],
    [UCSymbolKind.Delegate, NAME_DELEGATE],
    [UCSymbolKind.Operator, NAME_OPERATOR],
    [UCSymbolKind.ReplicationBlock, NAME_REPLICATION],
    [UCSymbolKind.DefaultPropertiesBlock, NAME_DEFAULTPROPERTIES],
    [UCSymbolKind.Statement, NAME_STATEMENT],
    [UCSymbolKind.Macro, NAME_MACRO],
]);

export function symbolKindToDisplayString(kind: UCSymbolKind): string {
    return SymboldKindToName.get(kind)!.text;
}

export const enum UCTypeKind {
    /** An unrecognized type */
    Error,
    None,
    Byte,
    Enum,
    Int,
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

export const TypeKindToName: Readonly<Map<UCTypeKind, Name>> = new Map([
    [UCTypeKind.Error, NAME_ERROR],
    [UCTypeKind.None, NAME_NONE],
    [UCTypeKind.Byte, NAME_BYTE],
    [UCTypeKind.Enum, NAME_ENUM],
    [UCTypeKind.Int, NAME_INT],
    [UCTypeKind.Bool, NAME_BOOL],
    [UCTypeKind.Float, NAME_FLOAT],
    [UCTypeKind.Object, NAME_OBJECT],
    [UCTypeKind.Name, NAME_NAME],
    [UCTypeKind.Delegate, NAME_DELEGATE],
    [UCTypeKind.Interface, NAME_INTERFACE],
    [UCTypeKind.Range, NAME_RANGE],
    [UCTypeKind.Struct, NAME_STRUCT],
    [UCTypeKind.Rotator, NAME_ROTATOR],
    [UCTypeKind.String, NAME_STRING],
    [UCTypeKind.Map, NAME_MAP],
    [UCTypeKind.Array, NAME_ARRAY],
    [UCTypeKind.Pointer, NAME_POINTER],
    [UCTypeKind.Button, NAME_BUTTON],
]);

export function typeKindToDisplayString(kind: UCTypeKind): string {
    return TypeKindToName.get(kind)!.text;
}

export interface ITypeSymbol extends ISymbol, IWithReference, IWithInnerSymbols {
    flags: ModifierFlags;

    /**
     * The type's dimension. Implies 1 if 'undefined' or if the dimension is bound to a type that was unresolved.
     *
     * 0 if working with a dynamic array.
     **/
    arrayDimension?: number;

    getTypeText(): string;
    getTypeKind(): UCTypeKind;
    getSymbolAtPos(position: Position): ISymbol | undefined;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo): void;
}

/**
 * A type to represent non user-defined types.
 */
export class UCTypeSymbol implements ITypeSymbol {
    readonly kind: UCSymbolKind = UCSymbolKind.Type;
    readonly id = DEFAULT_IDENTIFIER;

    declare outer: undefined;
    declare nextInHash: undefined;

    flags: ModifierFlags = 0;
    arrayDimension?: number;

    constructor(
        /** The UnrealScript type to represent. */
        readonly type: UCTypeKind,
        readonly range: Range = DEFAULT_RANGE,
        flags: ModifierFlags = 0,
    ) { this.flags = flags; }

    getName(): Name {
        return TypeKindToName.get(this.type)!;
    }

    getHash(): number {
        throw new Error('Method not implemented.');
    }

    getPath(): string {
        throw new Error('Method not implemented.');
    }

    getTypeKind(): UCTypeKind {
        return this.type;
    }

    getTooltip(): string {
        return `type ${this.getName().text}`;
    }

    getTypeText(): string {
        return this.getName().text;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (intersectsWithRange(position, this.range)) {
            return this;
        }

        return undefined;
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
        return visitor.visitType(this);
    }
}

/**
 * A type used to represent object references such as:
 *
 * 1. An object that could either be a `UCClassSymbol` or a `UCScriptStructSymbol` or any other descendant of `UCObjectSymbol`
 * usually represented by an identifier `Vector` or a qualified identifier `Object.Vector`
 * <br/>
 * 2. A class limitor such as `Class<MetaClass>`
 * reference = Class
 * baseType.reference = MetaClass
 * <br/>
 * 3. A delegate such as `Delegate<QualifiedIdentifier>`, see the more specific `UCDelegateTypeSymbol`
 * <br/>
 * 4. A symbol reference in any expression, such as `self.Name` where `Name` is wrapped with a `UCObjectTypeSymbol` and the reference is a `UCFieldSymbol`
 * <br/>
 * 5. An object literal such as `Class'Core.Object'`, the reference is the type of `Class` i.e. `UCClassSymbol` and the baseType is a `UCQualifiedTypeSymbol`, with the reference set to the symbol of `Core.Object`
 *
 * @property baseType - The base type such as a `UCQualifiedTypeSymbol` when representing a qualified identifier type, or the inner type of an array etc.
 * @property reference - A reference to the indexed symbol.
 */
export class UCObjectTypeSymbol<TBaseType extends ITypeSymbol = ITypeSymbol> implements ITypeSymbol {
    readonly kind: UCSymbolKind = UCSymbolKind.Type;

    flags: ModifierFlags = 0;
    arrayDimension?: number;

    /**
     * The resolved reference of this type.
     */
    protected reference?: ISymbol = undefined;

    /**
     * Any type that can be considered the base type,
     * or inner type such as an array's element type,
     * a class's meta class,
     * or the qualified type.
     **/
    public baseType?: TBaseType | undefined = undefined;

    constructor(
        readonly id: Identifier,
        readonly range: Range = id.range,
        private expectedKind?: UCSymbolKind,
        flags: ModifierFlags = 0,
    ) { this.flags = flags; }

    getName(): Name {
        return this.id.name;
    }

    getHash(): number {
        throw new Error('Method not implemented.');
    }

    getPath(): string {
        throw new Error('Method not implemented.');
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (!intersectsWith(this.range, position)) {
            return undefined;
        }

        const symbol = this.getContainedSymbolAtPos(position);
        if (symbol) {
            return symbol;
        }

        if (intersectsWithRange(position, this.id.range)) {
            return this;
        }

        return undefined;
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
            return `${this.getName().text}<${this.baseType.getTypeText()}>`;
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

    // TODO: Displace using a visitor pattern instead, too much spaghetti logic in UnrealScript and esp in this implementation!
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
            // class Foo extends id.Foo;
            case UCSymbolKind.Package:
                symbol = ObjectsTable.getSymbol<UCPackage>(id, UCSymbolKind.Package);
                break;

            // Class Foo extends id
            // var id.Foo MyClassVar;
            // dependsOn/implements(id)
            case UCSymbolKind.Class:
            case UCSymbolKind.Interface:
                symbol = tryFindClassSymbol(id);
                break;

            // Struct Foo extends context?.id
            case UCSymbolKind.ScriptStruct:
                // Prioritize parent-inherited structs first
                symbol = context.findSuperSymbol<UCStructSymbol>(id, UCSymbolKind.ScriptStruct)
                    ?? ObjectsTable.getSymbol<UCStructSymbol>(id, UCSymbolKind.ScriptStruct);
                break;

            // State Foo extends context?.id
            case UCSymbolKind.State:
                symbol = context.findSuperSymbol<UCStructSymbol>(id, UCSymbolKind.State);
                break;

            case UCSymbolKind.Delegate: {
                // The actual 'delegate' type will be verified during the analysis.
                // When qualified, we don't want to match an inherited delegate.
                if (info?.isQualified) {
                    symbol = context.getSymbol<UCDelegateSymbol>(id, UCSymbolKind.Delegate);
                } else {
                    symbol = document.class?.findSuperSymbol<UCDelegateSymbol>(id, UCSymbolKind.Delegate);
                }
                break;
            }

            // We expect a 'field' by a qualified identifier e.g. Object.Vector or Actor.ENetMode
            // Note Object/Actor here is represented as @context
            case UCSymbolKind.Field: {
                // e.g. "local Actor.Vector vector;" should also be able to pickup the inherited struct type.
                // Note: Only if the context type is of type class, but we should probably report an error during the analysis stage instead.
                symbol = context.findSuperSymbolPredicate<UCFieldSymbol>((symbol) => {
                    return (symbol.kind === UCSymbolKind.ScriptStruct || symbol.kind === UCSymbolKind.Enum)
                        && symbol.id.name === id;
                });
                break;
            }

            // We expect a non-qualified 'type' that is to say a class, enum, or a script struct in that order.
            case UCSymbolKind.Type: {
                // UC3 looks up types by using a global objects table
                // -- where as UE2 or earlier looks up the type in the outer most class repeatedly for each 'super' of the context.
                // -- but for our purposes let us always use the objects table approach (faster)
                // -- instead perform a re-lookup using the inheritance (and within class) approach to report diagnostics.
                symbol = tryFindClassSymbol(id)
                    ?? ObjectsTable.getSymbol(id, UCSymbolKind.Enum)
                    ?? ObjectsTable.getSymbol(id, UCSymbolKind.ScriptStruct)
                    ;
                break;
            }

            // We expect an enum, presumed to be only used outside of code blocks. i.e. `MyVar[MyConstOrMyEnum.MaybeEnumTag]`
            // As per the compiler:
            // We must prioritize const lookups in the current context
            // - its outers and the outer's inherited classes too.
            // If not found, look through the 'within' class of the outer most class and repeat.
            // - Repeat the same for 'Enum', if all fail then we must lookup the enum in the global table
            // - (this lets us pickup an enum declared in a 'dependson' class or a class compiled before)
            // - However this will also match enum's declared in any class that is yet-to-be-compiled, even an enum in an unrelated package.
            // - Perhaps we can run an analysis post-index to see if the enum is a possible 'dependency'
            case UCSymbolKind.Enum: {
                symbol = findOuterFieldSymbol(context, id, UCSymbolKind.Const)
                    ?? findOuterFieldSymbol(context, id, UCSymbolKind.Enum)
                    // Global lookup
                    ?? ObjectsTable.getSymbol(id, UCSymbolKind.Enum);

                break;
            }

            // No expected type, let's do a general (inheritance based) lookup
            default:
                // Ensure we are working with a valid context, bad user or incomplete code may give us an unsuitable context.
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
    override arrayDimension = 0;
    override reference = IntrinsicArray;

    /** @deprecated */
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
 * A type used to represent an object reference by a qualified identifier e.g. `Core.Object` and `Core.Object.Vector`
 */
export class UCQualifiedTypeSymbol implements ITypeSymbol {
    readonly range: Range;
    readonly kind: UCSymbolKind = UCSymbolKind.Type;
    readonly id: Identifier;

    flags: ModifierFlags = ModifierFlags.None;
    arrayDimension?: number;

    /**
     * A reference to the indexed symbol.
     */
    protected reference?: ISymbol = undefined;

    constructor(
        /** The actual type to work with, i.e. a `UCObjectTypeSymbol` with a reference to `Object` if the qualified type was parsed from `Core.Object' */
        public readonly type: UCObjectTypeSymbol,
        /** the other type representing the left side of a qualified type, like `Core` or even a `UCQualifiedTypeSymbol` to `Core.Object` if the qualified type was parsed from `Core.Object.Vector` */
        public readonly left?: UCQualifiedTypeSymbol,
    ) {
        this.id = type.id;
        this.range = type.id.range;
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

export const StaticErrorType = new UCTypeSymbol(UCTypeKind.Error);
export const StaticNoneType = new UCTypeSymbol(UCTypeKind.None, undefined, ModifierFlags.ReadOnly);
export const StaticByteType = new UCTypeSymbol(UCTypeKind.Byte);
export const StaticEnumType = new UCTypeSymbol(UCTypeKind.Enum);
export const StaticIntType = new UCTypeSymbol(UCTypeKind.Int);
export const StaticBoolType = new UCTypeSymbol(UCTypeKind.Bool);
export const StaticFloatType = new UCTypeSymbol(UCTypeKind.Float);
export const StaticNameType = new UCTypeSymbol(UCTypeKind.Name);
export const StaticStringType = new UCTypeSymbol(UCTypeKind.String);
export const StaticPointerType = new UCTypeSymbol(UCTypeKind.Pointer);
export const StaticButtonType = new UCTypeSymbol(UCTypeKind.Button);

export const StaticObjectType = new UCObjectTypeSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE });
export const StaticArrayType = new UCArrayTypeSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });
export const StaticMapType = new UCMapTypeSymbol({ name: NAME_MAP, range: DEFAULT_RANGE });
export const StaticDelegateType = new UCDelegateTypeSymbol({ name: NAME_DELEGATE, range: DEFAULT_RANGE });
export const StaticVectorType = new UCObjectTypeSymbol({ name: NAME_VECTOR, range: DEFAULT_RANGE },
    undefined,
    undefined,
    ModifierFlags.ReadOnly
);
export const StaticRotatorType = new UCObjectTypeSymbol({ name: NAME_ROTATOR, range: DEFAULT_RANGE },
    undefined,
    undefined,
    ModifierFlags.ReadOnly
);
export const StaticRangeType = new UCObjectTypeSymbol({ name: NAME_RANGE, range: DEFAULT_RANGE },
    undefined,
    undefined,
    ModifierFlags.ReadOnly
);
export const StaticMetaType = new UCMetaTypeSymbol({ name: NAME_TYPE, range: DEFAULT_RANGE });

// Const types to present literal expression types.
// Can't mark all static types as ReadOnly because we use those to present variable types too.

export const StaticConstByteType = new UCTypeSymbol(UCTypeKind.Byte, undefined, ModifierFlags.ReadOnly);
export const StaticConstIntType = new UCTypeSymbol(UCTypeKind.Int, undefined, ModifierFlags.ReadOnly);
export const StaticConstBoolType = new UCTypeSymbol(UCTypeKind.Bool, undefined, ModifierFlags.ReadOnly);
export const StaticConstFloatType = new UCTypeSymbol(UCTypeKind.Float, undefined, ModifierFlags.ReadOnly);
export const StaticConstNameType = new UCTypeSymbol(UCTypeKind.Name, undefined, ModifierFlags.ReadOnly);
export const StaticConstStringType = new UCTypeSymbol(UCTypeKind.String, undefined, ModifierFlags.ReadOnly);
export const StaticConstDelegateType = new UCTypeSymbol(UCTypeKind.Delegate, undefined, ModifierFlags.ReadOnly);

export const CastTypeSymbolMap: Readonly<WeakMap<Name, ITypeSymbol>> = new WeakMap([
    [NAME_BYTE, StaticConstByteType],
    [NAME_INT, StaticConstIntType],
    [NAME_BOOL, StaticConstBoolType],
    [NAME_FLOAT, StaticConstFloatType],
    [NAME_STRING, StaticConstStringType],
    [NAME_NAME, StaticConstNameType],
    // Oddly... conversion to a button is actually valid!
    [NAME_BUTTON, StaticConstBoolType]
]);

/** Conversion is illegal */
const N = 0x00;
/** Conversion is possible */
const Y = 0x01;
/** Conversion requires expansion that can be performed automatically, for instance a conversion from byte to int */
const E = 0x02;
/** Conversion requires truncation */
const T = 0x04;
/** Conversion requires shifting, for instance a conversion from a byte or int to float */
const S = 0x08;
/** Conversion can be performed automatically in a T3D context */
const D = 0x10;
/** Conversion requires zero conversion, for instance 'Object' to 'None' */
const Z = 0x20;
const ConversionMask = ~D;

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
/* From        Error    None        Byte        Enum        Int         Bool        Float       Object      Name    Delegate    Interface   Range   Struct  Vector  Rotator     String      Map     Array   Pointer
/* To       */
/* Error    */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* None     */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Byte     */[N,       N,          N,          Y | E,      Y | E | T,  Y,          Y | E | T,  N,          N,      N,          N,          N,      N,      N,      N,          Y,          N,      N,      N],
/* Enum     */[N,       N,          Y | E,      N,          Y | E | T,  N,          N,          Y,          N,      N,          N,          N,      N,      N,      N,          Y,          N,      N,      N],
/* Int      */[N,       N,          Y | E,      Y | E,      N,          Y,          Y | E | T,  N,          N,      N,          N,          N,      N,      N,      N,          Y,          N,      N,      N],
/* Bool     */[N,       N,          Y,          N,          Y | D,      N,          Y,          Y,          Y,      N,          Y,          N,      N,      Y,      Y,          Y,          N,      N,      N],
/* Float    */[N,       N,          Y | E | S,  N,          Y | E | S,  Y,          N,          N,          N,      N,          N,          N,      N,      N,      N,          Y,          N,      N,      S],
/* Object   */[N,       Y | Z,      N,          Y,          N,          N,          N,          N,          N,      N,          E,          N,      N,      N,      N,          N,          N,      N,      N],
/* Name     */[N,       Y | Z,      N,          N,          N,          D,          N,          N,          N,      N,          N,          N,      N,      N,      N,          Y | D,      N,      N,      N],
/* Delegate */[N,       Y | Z,      N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Interface*/[N,       Y | Z,      N,          N,          N,          N,          N,          Y | E,      N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Range    */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Struct   */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Vector   */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      Y,          Y,          N,      N,      N],
/* Rotator  */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      Y,      N,          Y,          N,      N,      N],
/* String   */[N,       N,          Y,          Y,          Y,          Y,          Y,          Y,          Y,      Y,          Y,          N,      N,      Y,      Y,          N,          N,      N,      N],
/* Map      */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Array    */[N,       N,          N,          N,          N,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
/* Pointer  */[N,       N,          N,          N,          D,          N,          N,          N,          N,      N,          N,          N,      N,      N,      N,          N,          N,      N,      N],
];
/** @formatter:on */

export function getTypeConversionFlags(
    inputTypeKind: UCTypeKind,
    destTypeKind: UCTypeKind
): number {
    return TypeConversionFlagsTable[destTypeKind][inputTypeKind];
}

export function resolveTypeKind(type: ITypeSymbol): UCTypeKind {
    if (type.getName() === NAME_VECTOR) {
        return UCTypeKind.Vector;
    }

    if (type.getName() === NAME_ROTATOR) {
        return UCTypeKind.Rotator;
    }

    return type.getTypeKind();
}

export const enum UCConversionCost {
    Zero = 0,
    // 1 - 99 directly define the relative cost, e.g. a conversion to an inherited class
    Expansion = 100,
    Shift = 200,
    Truncation = 300,
    Undetermined = 400,
    Illegal = 0x7FFFFFFF,
}

export function getConversionCost(
    inputType: ITypeSymbol,
    destType: ITypeSymbol,
    matchFlags: TypeMatchFlags = TypeMatchFlags.None
): UCConversionCost {
    // Cannot convert multi-dimension types (i.e. var int Variable[2])
    if ((destType.flags | inputType.flags) & ModifierFlags.WithDimension) {
        return UCConversionCost.Illegal;
    }

    const inputTypeKind = resolveTypeKind(inputType);
    if (inputTypeKind === UCTypeKind.Error) {
        return UCConversionCost.Undetermined;
    }

    const destTypeKind = resolveTypeKind(destType);
    if (destTypeKind === UCTypeKind.Error) {
        return UCConversionCost.Undetermined;
    }

    // Out params must be EXACT matches
    if (destType.flags & ModifierFlags.Out) {
        if (inputTypeKind === destTypeKind) {
            return UCConversionCost.Zero;
        }

        if (typesMatch(inputType, destType, matchFlags & ~TypeMatchFlags.Generalize) > 0) {
            // return UCConversionCost.Zero;
        }

        return UCConversionCost.Illegal;
    }

    if (inputTypeKind === destTypeKind) {
        if (inputTypeKind === UCTypeKind.Object ||
            inputTypeKind === UCTypeKind.Interface ||
            inputTypeKind === UCTypeKind.Struct) {
            let inputStruct = inputType.getRef<UCStructSymbol>();
            if (!inputStruct) {
                return UCConversionCost.Illegal;
            }

            const destStruct = destType.getRef<UCStructSymbol>();
            if (!destStruct) {
                return UCConversionCost.Illegal;
            }

            if (areIdentityMatch(inputStruct, destStruct)) {
                return UCConversionCost.Zero;
            }

            let depth = 1;
            const hash = destStruct.getHash();
            for (inputStruct = inputStruct.super; inputStruct; inputStruct = inputStruct.super, ++depth) {
                if (inputStruct === destStruct || inputStruct.getHash() === hash) {
                    return depth as UCConversionCost;
                }
            }

            // Incompatible, because no inheritance.
            return UCConversionCost.Illegal;
        }

        return UCConversionCost.Zero;
    }

    if (inputTypeKind === UCTypeKind.Object &&
        destTypeKind === UCTypeKind.Interface) {
        let inputClass = inputType.getRef<UCClassSymbol>();
        if (!inputClass || !isClassSymbol(inputClass)) {
            return UCConversionCost.Illegal;
        }

        const destInterface = destType.getRef<UCInterfaceSymbol>();
        if (!destInterface || !isInterfaceSymbol(inputClass)) {
            return UCConversionCost.Illegal;
        }

        let depth = 1;
        for (; inputClass; inputClass = inputClass.super, ++depth) {
            if (!inputClass.implementsTypes?.some(type => {
                return type.getRef() && areDescendants(destInterface, type.getRef()!);
            })) {
                break;
            }
        }

        // Incompatible, class does not implement the interface.
        if (depth === 1) {
            return UCConversionCost.Illegal;
        }

        return depth as UCConversionCost;
    }

    const flags = getTypeConversionFlags(inputTypeKind, destTypeKind);
    if ((flags & ConversionMask) === N) {
        return UCConversionCost.Illegal;
    }

    // FIXME: Not entirely correct
    if ((flags & Y) && (destType.flags & ModifierFlags.Coerce)) {
        return UCConversionCost.Expansion;
    }

    if (flags & T) {
        return UCConversionCost.Truncation;
    }

    if (flags & S) {
        return UCConversionCost.Shift;
    }

    if (flags & E) {
        return UCConversionCost.Expansion;
    }

    if (flags & Z) {
        // 'None' to 'Object' cost should be 1
        return 1 as UCConversionCost;
    }

    return UCConversionCost.Illegal;
}

export const enum TypeMatchFlags {
    None = 0,

    /** Type comparison is allowed to be generalized, such as 'Int' -> 'Float' */
    Generalize = 1 << 0,

    /** Type comparison is to be coerced, such as 'Int' -> 'String'. */
    Coerce = 1 << 2,

    /**
     * Type comparison is within a T3D (defaultproperties) context.
     *
     * We have to presume different rules for assignments within a DefaultProperties block.
     * e.g. A boolean type can be assigned to a name as it interpreted as an identifier.
     **/
    T3D = 1 << 3,

    /** Type comparison should suppress the check for 'Out' types. */
    SuppressOut = 1 << 4
}

export const enum TypeMatchReport {
    ArrayDimensionMismatch = -1,

    OutConstMismatch = -2,
    OutClassAndInterfaceMixup = -3,

    StructMismatch = -4,
    ClassMismatch = -5,
    MetaClassMismatch = -6,
    ClassAndInterfaceMismatch = -7,

    /** Type match is uncompatible, but may still be expandable or convertable if conversion is allowed. */
    Incompatible = 0,

    /** Type match is compatible, 'Object' -> 'Interface' */
    Compatible = 1,

    /** Type match is identical, 'Int' == 'Int' */
    Identical,

    /** Type match is convertable, 'Int' -> 'String' */
    Convertable,

    /** Type match is expandable, 'Byte' -> 'Int' */
    Expandable,

    /** Type match is undetermined due unsufficient data, greater than 0 to silence any errors. */
    Undetermined,
}

/**
 * (dest) SomeObject = (input) none;
 */
export function typesMatch(
    inputType: ITypeSymbol,
    destType: ITypeSymbol,
    matchFlags: TypeMatchFlags
): TypeMatchReport {
    // Ignore types with no reference (Error)
    let inputTypeKind = inputType.getTypeKind();
    if (inputTypeKind === UCTypeKind.Error) {
        return TypeMatchReport.Undetermined;
    }

    let destTypeKind = destType.getTypeKind();
    if (destTypeKind === UCTypeKind.Error) {
        return TypeMatchReport.Undetermined;
    }

    if (destType.arrayDimension !== inputType.arrayDimension) {
        return TypeMatchReport.ArrayDimensionMismatch;
    }

    // TODO: Unit tests for UC1 and UC2.
    if (destType.flags & ModifierFlags.Out && (matchFlags & TypeMatchFlags.SuppressOut) === 0) {
        // 'Const' inputs cannot be matched with a const param.
        if (
            // UE3 requires the other type to be non-const.
            (config.generation === UCGeneration.UC3 && (
                (inputType.flags & ModifierFlags.ReadOnly) !== 0
                && (destType.flags & ModifierFlags.ReadOnly) === 0
            ))
            ||
            // UE1 and UE2 requires the other type to be an 'Out' even if the source type is not a 'Const'
            (config.generation < UCGeneration.UC3 && (
                (inputType.flags & ModifierFlags.ReadOnly) !== 0
                // Not supported yet (or even necessary), the current code is not applying any 'Out' flags based on context usage.
                // || (inputType.flags & ModifierFlags.Out) === 0
            ))
        ) {
            return TypeMatchReport.OutConstMismatch;
        }

        // Cannot match mixed 'Object' and 'Interface' types.
        if (destTypeKind !== inputTypeKind
            // both types are one of ...
            && (destTypeKind === UCTypeKind.Object || destTypeKind === UCTypeKind.Interface)
            && (inputTypeKind === UCTypeKind.Object || inputTypeKind === UCTypeKind.Interface)
        ) {
            return TypeMatchReport.OutClassAndInterfaceMixup;
        }

        if ((destTypeKind !== UCTypeKind.Object || inputTypeKind !== UCTypeKind.Object) &&
            (destTypeKind !== UCTypeKind.Interface || inputTypeKind !== UCTypeKind.Interface)) {
            // Disallow generalization to an 'Out' destination.
            matchFlags &= ~TypeMatchFlags.Generalize;
        }
    }

    inputTypeKind = resolveTypeKind(inputType);
    destTypeKind = resolveTypeKind(destType);
    if (inputTypeKind === destTypeKind) {
        // If we are expecting an assignment to an object that has a class type, then verify that the input class is compatible.
        if ((destTypeKind === UCTypeKind.Object ||
             destTypeKind === UCTypeKind.Interface)
            // Safety check to ensure that we are working with resolved types.
            && isClass(destType.getRef())
            && isClass(inputType.getRef())) {
            // e.g. "var Class","var Class<ClassLimitor>", or "Class'ClassReference'"
            if (destType.getRef() === IntrinsicClass) {
                // Resolves Class<destMetaClass>
                const destMetaClass = hasDefinedBaseType(destType)
                    && destType.baseType.getRef<UCClassSymbol>();
                if (destMetaClass) {
                    const inputMetaClass = hasDefinedBaseType(inputType)
                        ? inputType.baseType.getRef<UCClassSymbol>()
                        // e.g. a MyClass as input to destination of Class<MyClass>
                        : inputType.getRef<UCClassSymbol>();
                    if (!inputMetaClass) {
                        return TypeMatchReport.Undetermined;
                    }

                    if ((matchFlags & TypeMatchFlags.Generalize) === 0) {
                        return areIdentityMatch(destMetaClass, inputMetaClass)
                            ? TypeMatchReport.Identical
                            : TypeMatchReport.MetaClassMismatch;
                    }

                    if (areDescendants(destMetaClass, inputMetaClass)) {
                        return TypeMatchReport.Compatible;
                    }

                    return TypeMatchReport.MetaClassMismatch;
                }

                // Any class derivative is compatible with the intrinsic class object.
                return TypeMatchReport.Compatible;
            }

            if ((matchFlags & TypeMatchFlags.Generalize) === 0) {
                return areIdentityMatch(destType.getRef<UCStructSymbol>()!, inputType.getRef<UCStructSymbol>()!)
                    ? TypeMatchReport.Identical
                    : TypeMatchReport.ClassMismatch;
            }

            // e.g. "var AClassName", see if the input class is a derivative of "AClassName"
            if (areDescendants(
                destType.getRef<UCStructSymbol>()!,
                inputType.getRef<UCStructSymbol>()!
            )) {
                return TypeMatchReport.Compatible;
            }

            return TypeMatchReport.ClassMismatch;
        }

        if (destTypeKind === UCTypeKind.Struct
            // Safety check to ensure that we are working with resolved types.
            && isScriptStructSymbol(destType.getRef()!)
            && isScriptStructSymbol(inputType.getRef()!)) {
            if ((matchFlags & TypeMatchFlags.Generalize) === 0) {
                return areIdentityMatch(destType.getRef<UCStructSymbol>()!, inputType.getRef<UCStructSymbol>()!)
                    ? TypeMatchReport.Identical
                    : TypeMatchReport.StructMismatch;
            }

            if (areDescendants(
                destType.getRef<UCStructSymbol>()!,
                inputType.getRef<UCStructSymbol>()!
            )) {
                return TypeMatchReport.Compatible;
            }

            return TypeMatchReport.StructMismatch;
        }

        return TypeMatchReport.Identical;
    }

    // Assigning object to an interface?
    if (inputTypeKind === UCTypeKind.Interface &&
        destTypeKind === UCTypeKind.Object) {
        const destClass = destType.getRef<UCClassSymbol>();
        if (!destClass || !isClassSymbol(destClass)) {
            return TypeMatchReport.Undetermined;
        }

        const inputInterface = inputType.getRef<UCInterfaceSymbol>();
        if (!inputInterface || !isInterfaceSymbol(inputInterface)) {
            return TypeMatchReport.Undetermined;
        }

        // FIXME:
        // if ((matchFlags & TypeMatchFlags.Generalize) === 0) {
        //     return TypeMatchReport.Incompatible;
        // }

        if (classImplementsInterface(destClass, inputInterface)) {
            return TypeMatchReport.Compatible;
        }

        return TypeMatchReport.ClassAndInterfaceMismatch;
    }

    // Not a perfect match, see if we can convert or even coerce the types.
    const c = getTypeConversionFlags(inputTypeKind, destTypeKind);

    if ((c & Z) !== 0 && (matchFlags & TypeMatchFlags.Generalize) !== 0) {
        return TypeMatchReport.Compatible;
    }

    // Convertable? Only if the destiny is marked with 'Coerce'
    if ((c & Y) !== 0 && ((destType.flags & ModifierFlags.Coerce) !== 0 || (matchFlags & TypeMatchFlags.Coerce) !== 0)) {
        return TypeMatchReport.Convertable;
    }

    // Expandable? Only if auto-conversion is allowed.
    if ((c & E) !== 0 && (matchFlags & TypeMatchFlags.Generalize) !== 0) {
        return TypeMatchReport.Expandable;
    }

    if (c === N) {
        // FIXME: ???
        if (destTypeKind === UCTypeKind.Delegate) {
            return (inputType.getRef()?.kind === UCSymbolKind.Function) as unknown as TypeMatchReport;
        }

        return TypeMatchReport.Incompatible;
    }

    if ((c & D) !== 0 && (matchFlags & TypeMatchFlags.T3D) !== 0) {
        return TypeMatchReport.Convertable;
    }

    return TypeMatchReport.Incompatible;
}

/** Resolves a type to its base type if set. e.g. "Class&lt;Actor&gt;" would be resolved to "Actor", if "Actor" is missing it will resolve to "Class" instead. */
export function resolveType(type: ITypeSymbol): ITypeSymbol {
    return hasDefinedBaseType(type) ? type.baseType : type;
}

/**
 * Resolves a given type to its appropriate element type i.e. an (`Array<int>`) type will be resolved to its inner type 'Int'
 *
 * @param type type to resolve to an element type.
 * @returns element type, or 'None' if the type is inaccessible. `undefined` if the base type is missing.
 */
export function resolveElementType(type: ITypeSymbol): ITypeSymbol | undefined {
    if (isArrayTypeSymbol(type)) {
        // the actual array type `MyType` e.g. `Array<MyType>`
        return type.baseType;
    }

    if (isFixedArrayTypeSymbol(type)) {
        // Would be nice if we had a baseType for fixed arrays, but that complicates matters too much.
        return Object.create(type, {
            flags: { value: type.flags & ~ModifierFlags.WithDimension },
            arrayDimension: { value: undefined }
        });
    }

    return StaticNoneType;
}

export function hasDefinedBaseType(
    type: ITypeSymbol & { baseType?: ITypeSymbol | undefined }
): type is UCObjectTypeSymbol & { baseType: ITypeSymbol } {
    return typeof type.baseType !== 'undefined';
}

export function hasDefinedSuper(
    symbol: SuperSymbol
): symbol is SuperSymbol & { super: UCStructSymbol } {
    return typeof symbol.super !== 'undefined';
}

export function areDescendants(
    parentSymbol: SuperSymbol,
    derivedSymbol: SuperSymbol
): boolean {
    // shortcut
    if (parentSymbol === derivedSymbol) {
        return true;
    }

    let other: SuperSymbol | undefined = derivedSymbol;

    // We compare by hash, because we could be working with multiple and outdated instances of the same object.
    const hash = parentSymbol.getHash();
    while (other) {
        if (other === parentSymbol || other.getHash() === hash) {
            return true;
        }

        other = other.super;
    }

    return false;
}

/**
 * Checks if the source and target are compatible by return type and parameters.
 * Generally used to validate an assignment or comparison of a delegate to a function/delegate.
 *
 * @param source source method to compare to.
 * @param target target method to be compared.
 * @returns true if the return type and the param types are compatible.
 */
export function areMethodsCompatible(
    source: UCMethodSymbol,
    target: UCMethodSymbol
): boolean {
    if (source === target) {
        return true;
    }

    if (source.returnValue) {
        if ((!target.returnValue ||
            !typesMatch(source.returnValue.type, target.returnValue.type, TypeMatchFlags.None))) {
            return false;
        }
    } else if (target.returnValue) {
        return false;
    }

    if (source.params) {
        if (typeof target.params === 'undefined' ||
            source.params.length !== target.params.length) {
            return false;
        }

        for (let i = 0; i < source.params.length; ++i) {
            if (!typesMatch(source.params[i].type, target.params[i].type, TypeMatchFlags.None)) {
                return false;
            }
        }
    } else if (target.params) {
        return false;
    }

    return true;
}

export function classImplementsInterface(
    classSymbol: UCClassSymbol,
    interfaceSymbol: UCInterfaceSymbol
): boolean {
    for (let parent: UCClassSymbol | undefined = classSymbol; parent; parent = parent.super) {
        if (parent.implementsTypes?.some(type => {
            return type.getRef() && areDescendants(interfaceSymbol, type.getRef()!);
        })) {
            return true;
        }
    }

    return false;
}

export function hasModifiers(
    symbol: (ISymbol & { modifiers?: ModifierFlags })
): symbol is ISymbol & { modifiers: ModifierFlags } {
    return typeof symbol.modifiers !== 'undefined';
}

export function isSymbol(symbol: ISymbol): symbol is ISymbol {
    return typeof symbol.kind !== 'undefined';
}

export function isPackage(symbol: ISymbol): symbol is UCPackage {
    return symbol.kind === UCSymbolKind.Package;
}

export function isField(
    symbol: (ISymbol & { modifiers?: ModifierFlags }) | undefined
): symbol is UCFieldSymbol {
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

export function isDelegateSymbol(symbol: ISymbol): symbol is UCDelegateSymbol {
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

export function isClassSymbol(symbol: ISymbol): symbol is UCClassSymbol {
    return symbol.kind === UCSymbolKind.Class;
}

export function isInterfaceSymbol(symbol: ISymbol): symbol is UCInterfaceSymbol {
    return symbol.kind === UCSymbolKind.Interface;
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

export function isTypeSymbol(symbol: ISymbol): symbol is ITypeSymbol {
    return symbol.kind === UCSymbolKind.Type;
}

export function isArrayTypeSymbol(symbol: ISymbol): symbol is UCArrayTypeSymbol {
    return symbol.getTypeKind() === UCTypeKind.Array;
}

export function isFixedArrayTypeSymbol(symbol: ISymbol): symbol is ITypeSymbol {
    return isTypeSymbol(symbol) && !!(symbol.arrayDimension && symbol.arrayDimension > 1);
}

export function isQualifiedType(symbol?: ISymbol): symbol is UCQualifiedTypeSymbol {
    return symbol instanceof UCQualifiedTypeSymbol;
}
