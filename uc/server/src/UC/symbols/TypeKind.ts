export enum UCTypeKind {
	// PRIMITIVE TYPES
	String,
	Name,
	Int,
	Float,
	Byte,
	Bool,

	// OBJECT TYPES

	// For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Package,
	Class,
	Enum,
	Struct,
	State,
	Function,
	None,

	// A type that couldn't be found.
	Error
}
