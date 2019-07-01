export enum UCTypeKind {
	// PRIMITIVE TYPES
	Float,
	// Also true for a pointer
	Int,
	// Also true for an enum member.
	Byte,
	String,
	Name,
	Bool,

	// OBJECT TYPES
	// i.e. "Enum'ENetRole'"
	Object,
	// For use cases like e.g. "class Actor extends Core.Object" where "Core" would be of type "Package".
	Package,
	// A class like class<CLASSNAME>.
	Class,
	Interface,
	Enum,
	State,
	Struct,
	Function,
	Delegate,

	// Reffers the special "None" identifier, if we do actual reffer an undefined symbol, we should be an @Error.
	None,

	// A type that couldn't be found.
	Error
}
