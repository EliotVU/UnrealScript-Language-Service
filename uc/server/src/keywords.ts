export const CLASS_DECLARATIONS = [
	'class', 'const', 'enum', 'struct', 'var',
	'function', 'event',
	'operator', 'preoperator', 'postoperator',
	'state',
	'cpptext',
	'defaultproperties'
];

export const STRUCT_DECLARATIONS = [
	'const', 'enum', 'struct', 'var',
	'structcpptext',
	'structdefaultproperties'
];

export const FUNCTION_DECLARATIONS = [
	'const', 'local'
];

export const STRUCT_MODIFIERS = [
	'native', 'long'
];

export const PRIMITIVE_TYPE_NAMES = [
	'int', 'float', 'byte', 'name', 'string',
	'bool', 'array', 'map', 'class', 'pointer'
];

export const COMMON_MODIFIERS = ['public', 'protected', 'private', 'const', 'native'];
export const FUNCTION_MODIFIERS = COMMON_MODIFIERS.concat(['simulated', 'final', 'static']);
export const VARIABLE_MODIFIERS = COMMON_MODIFIERS.concat(['config']);
