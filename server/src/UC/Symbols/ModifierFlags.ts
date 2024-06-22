/**
 * An all in one set of flags for UProperty kinds.
 *
 * Some flags are shared with @see MethodFlags and @see ClassModifiers.
 */
export const enum ModifierFlags {
    None = 0,

    // FieldFlags
    /** The field is marked as 'protected' */
    Protected = 1 << 0,

    /** The field is marked as 'private' */
    Private = 1 << 1,

    NotPublic = Protected | Private,

    /** The field is marked as 'native' or 'intrinsic' */
    Native = 1 << 2,

    /** The field is marked as 'const' or treated as readonly (for intrinsics) */
    ReadOnly = 1 << 3, // aka Const

    /** The field has a specified element size. e.g. `var int MyVar[2];` */
    WithDimension = 1 << 4, // A multiple dimension property

    /** The field is marked as 'transient' */
    Transient = 1 << 6,

    // ParamFlags
    /** The field is a parameter of a function. */
    Param = 1 << 7,

    /** The field is a return parameter (generated) of a function. */
    ReturnParam = 1 << 8,

    /** The field is marked as 'out' */
    Out = 1 << 9,

    /** The field is marked as 'optional' */
    Optional = 1 << 10,

    /** The field is marked as 'init' */
    Init = 1 << 11, // NOT SUPPORTED

    /** The field is marked as 'skip' */
    Skip = 1 << 12, // NOT SUPPORTED

    /** The field is marked as 'coerce' */
    Coerce = 1 << 13,

    // XCom
    /** The field is marked as 'ref' */
    Ref = 1 << 14, // NOT SUPPORTED

    // LocalFlags
    /** The field is a local field of a function or state. */
    Local = 1 << 15,

    // ClassFlags
    /** The field is marked as 'abstract' */
    Abstract = 1 << 16, // TODO: Unify with ClassModifiers?

    // InternalFlags
    /**
     * Field is an intrisic symbol, not to be confused with the older 'intrinsic' native keyword.
     * That means the symbol was not contructed from an UnrealScript counter part or is not designed in a way that it ever could be.
     * For instance:
     *  - 'ArrayIterator' an iterator function symbol to deal with a `foreach` loop on a dynamic array.
     *  - 'IntrinsicVectLiteral' a function to represent a `vect(...)` literal.
     *  - 'Core.Class' a class with no UnrealScript counter part (a Class.uc file)
     **/
    Intrinsic = 1 << 17,

    /** The field is a generated symbol, such as the return type of a function. */
    Generated = 1 << 18,

    /** The field is a keyword symbol, such as `Vect` */
    Keyword = 1 << 19,

    /** The field should not index a declaration reference. */
    NoDeclaration = 1 << 20,

    /** The field is marked as 'deprecated' */
    Deprecated = 1 << 21,

    // A private method can however be re-defined!
    NonOverridable = Private | Intrinsic,
}
