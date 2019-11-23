lexer grammar UCLexer;

channels { MACRO, COMMENTS_CHANNEL }

@lexer::members {
	parensLevel: number = 0;
	braceLevel: number = 0;
	isDefineContext: boolean = false;
}

fragment EXPONENT: [eE] [+-]? [0-9]+;
fragment HEX_DIGIT: [0-9] | [A-F] | [a-f];
fragment ESC_SEQ: '\\' .;

fragment CALL_MACRO_CHAR: '\u0060';

LINE_COMMENT
	: '//' ~[\r\n]*
	-> channel(COMMENTS_CHANNEL)
	;

BLOCK_COMMENT
	: '/*' .*? '*/'
	-> channel(COMMENTS_CHANNEL)
	;

WS
	: [ \t\r\n]+
	-> channel(HIDDEN)
	;

MACRO_CHAR
	: CALL_MACRO_CHAR
	-> channel(MACRO), pushMode(MACRO_MODE)
	;

STRING: '"' (~["\\] | ESC_SEQ)* '"';
NAME: '\'' (~['\\] | ESC_SEQ)* '\'';

KW_DEFAULT: 'default';
KW_GLOBAL: 'global';
KW_CLASS: 'class';
KW_INTERFACE: 'interface';
KW_WITHIN: 'within';
KW_CONST: 'const';
KW_ENUM: 'enum';
KW_STRUCT: 'struct';
KW_VAR: 'var';
KW_LOCAL: 'local';
KW_REPLICATION: 'replication';
KW_STATE: 'state';
KW_MAP: 'map';
KW_DEFAULTPROPERTIES: 'defaultproperties';
KW_STRUCTDEFAULTPROPERTIES: 'structdefaultproperties';
KW_FOR: 'for';
KW_FOREACH: 'foreach';
KW_RETURN: 'return';
KW_BREAK: 'break';
KW_CONTINUE: 'continue';
KW_STOP: 'stop';
KW_CASE: 'case';
KW_SWITCH: 'switch';
KW_UNTIL: 'until';
KW_DO: 'do';
KW_WHILE: 'while';
KW_ELSE: 'else';
KW_IF: 'if';
KW_IGNORES: 'ignores';
KW_UNRELIABLE: 'unreliable';
KW_RELIABLE: 'reliable';
KW_CPPTEXT: 'cpptext';
KW_STRUCTCPPTEXT: 'structcpptext';
KW_CPPSTRUCT: 'cppstruct';
KW_ARRAY: 'array';
KW_BYTE: 'byte';
KW_INT: 'int';
KW_FLOAT: 'float';
KW_STRING: 'string';
KW_BUTTON: 'button';
KW_BOOL: 'bool';
KW_NAME: 'name';
KW_TRUE: 'true';
KW_FALSE: 'false';
KW_NONE: 'none';
KW_EXTENDS: 'extends';
KW_PUBLIC: 'public';
KW_PROTECTED: 'protected';
KW_PROTECTEDWRITE: 'protectedwrite';
KW_PRIVATE: 'private';
KW_PRIVATEWRITE: 'privatewrite';
KW_LOCALIZED: 'localized';
KW_OUT: 'out';
KW_OPTIONAL: 'optional';
KW_INIT: 'init';
KW_SKIP: 'skip';
KW_COERCE: 'coerce';
KW_FINAL: 'final';
KW_LATENT: 'latent';
KW_SINGULAR: 'singular';
KW_STATIC: 'static';
KW_EXEC: 'exec';
KW_ITERATOR: 'iterator';
KW_SIMULATED: 'simulated';
KW_AUTO: 'auto';
KW_NOEXPORT: 'noexport';
KW_NOEXPORTHEADER: 'noexportheader';
KW_EDITCONST: 'editconst';
KW_EDFINDABLE: 'edfindable';
KW_EDITINLINE: 'editinline';
KW_EDITINLINENOTIFY: 'editinlinenotify';
KW_EDITINLINEUSE: 'editinlineuse';
KW_EDITHIDE: 'edithide';
KW_EDITCONSTARRAY: 'editconstarray';
KW_EDITFIXEDSIZE: 'editfixedsize';
KW_EDITORONLY: 'editoronly';
KW_EDITORTEXTBOX: 'editortextbox';
KW_NOCLEAR: 'noclear';
KW_NOIMPORT: 'noimport';
KW_NONTRANSACTIONAL: 'nontransactional';
KW_SERIALIZETEXT: 'serializetext';
KW_CONFIG: 'config';
KW_GLOBALCONFIG: 'globalconfig';
KW_NATIVE: 'native';
KW_INTRINSIC: 'intrinsic';
KW_EXPORT: 'export';
KW_LONG: 'long';
KW_TRANSIENT: 'transient';
KW_CACHE: 'cache';
KW_INTERP: 'interp';
KW_REPRETRY: 'repretry';
KW_REPNOTIFY: 'repnotify';
KW_NOTFORCONSOLE: 'notforconsole';
KW_ARCHETYPE: 'archetype';
KW_CROSSLEVELACTIVE: 'crosslevelactive';
KW_CROSSLEVELPASSIVE: 'crosslevelpassive';
KW_ALLOWABSTRACT: 'allowabstract';
KW_AUTOMATED: 'automated';
KW_TRAVEL: 'travel';
KW_Input: 'input';
KW_INSTANCED: 'instanced';
KW_DATABINDING: 'databinding';
KW_DUPLICATETRANSIENT: 'duplicatetransient';
KW_PARSECONFIG: 'parseconfig';
KW_CLASSREDIRECT: 'classredirect';
KW_DEPRECATED: 'deprecated';
KW_STRICTCONFIG: 'strictconfig';
KW_ATOMIC: 'atomic';
KW_ATOMICWHENCOOKED: 'atomicwhencooked';
KW_IMMUTABLE: 'immutable';
KW_IMMUTABLEWHENCOOKED: 'immutablewhencooked';
KW_VIRTUAL: 'virtual';
KW_SERVER: 'server';
KW_CLIENT: 'client';
KW_DLLIMPORT: 'dllimport';
KW_DEMORECORDING: 'demorecording';
KW_GOTO: 'goto';
KW_ASSERT: 'assert';
KW_BEGIN: 'begin';
KW_OBJECT: 'object';
KW_END: 'end';
KW_FUNCTION: 'function';
KW_EVENT: 'event';
KW_DELEGATE: 'delegate';
KW_OPERATOR: 'operator';
KW_PREOPERATOR: 'preoperator';
KW_POSTOPERATOR: 'postoperator';
KW_SELF: 'self';
KW_SUPER: 'super';
KW_POINTER: 'pointer';
KW_EXPANDS: 'expands';
KW_K2CALL: 'k2call';
KW_K2PURE: 'k2pure';
KW_K2OVERRIDE: 'k2override';
KW_NEW: 'new';
KW_VECT: 'vect';
KW_ROT: 'rot';
KW_RNG: 'rng';
KW_ARRAYCOUNT: 'arraycount';
KW_NAMEOF: 'nameof';
KW_SIZEOF: 'sizeof';
KW_REF: 'ref';

// Note: Keywords must precede the ID token.
ID:	[a-zA-Z_][a-zA-Z0-9_]*;
// ID:	[a-z_][a-z0-9_]*;

FLOAT
	: [0-9]+ '.' [0-9fF]+ EXPONENT? [fF]?
	| [0-9]+ ([fF] | EXPONENT [fF]?)
	;

INTEGER
	: [0-9] [xX] HEX_DIGIT+
	| [0-9]+
	;

ESCAPE: '\\';

OPEN_PARENS: '(';
CLOSE_PARENS: ')';

OPEN_BRACE: '{';
CLOSE_BRACE: '}';

OPEN_BRACKET: '[';
CLOSE_BRACKET: ']';

SEMICOLON: ';';
COMMA: ',';

COLON: ':';
INTERR: '?';

SQUOT: '\'';

SHARP: '#';
PLUS: '+';
MINUS: '-';
DOT: '.';
AT: '@';
DOLLAR: '$';
BANG: '!';
AMP: '&';
BITWISE_OR: '|';
STAR: '*';
CARET: '^';
DIV: '/';
MODULUS: '%';
TILDE: '~';

LT: '<';
GT: '>';
OR: '||';
AND: '&&';
EQ: '==';
NEQ: '!=';
GEQ: '>=';
LEQ: '<=';
IEQ: '~=';
MEQ: '^^';

INCR: '++';
DECR: '--';
EXP: '**';
RSHIFT: '>>';
LSHIFT: '<<';
SHIFT: '>>>';

ASSIGNMENT: '=';
ASSIGNMENT_INCR: '+=';
ASSIGNMENT_DECR: '-=';
ASSIGNMENT_AT: '@=';
ASSIGNMENT_DOLLAR: '$=';
ASSIGNMENT_AND: '&=';
ASSIGNMENT_OR: '|=';
ASSIGNMENT_STAR: '*=';
ASSIGNMENT_CARET: '^=';
ASSIGNMENT_DIV: '/=';

ERROR: . -> channel(HIDDEN);

mode MACRO_MODE;

MACRO_WS:         			[ \t]+                     	-> channel(HIDDEN), type(WS);
MACRO_SINGLE_LINE_COMMENT: 	'//' ~[\r\n]*  				-> channel(COMMENTS_CHANNEL), type(LINE_COMMENT);
MACRO_CHAR_INLINED
	: CALL_MACRO_CHAR
	-> channel(MACRO), type(MACRO_CHAR)
	;

MACRO_DEFINE
	: 'define'
	{
		this.isDefineContext = true;
	}
	-> channel(MACRO)
	;

MACRO_UNDEFINE:             'undefine'                  -> channel(MACRO);
MACRO_INCLUDE:				'include'					-> channel(MACRO);
MACRO_IS_DEFINED:			'isdefined'                 -> channel(MACRO);
MACRO_NOT_DEFINED:			'notdefined'                -> channel(MACRO);
MACRO_COUNTER:				'counter'                   -> channel(MACRO);
MACRO_GET_COUNTER:			'getcounter'                -> channel(MACRO);
MACRO_SET_COUNTER:			'setcounter'                -> channel(MACRO);
MACRO_IF:                  	'if'                        -> channel(MACRO), type(KW_IF);
MACRO_ELSE:                	'else'                      -> channel(MACRO), type(KW_ELSE);
MACRO_ELSE_IF:              'elseif'                    -> channel(MACRO);
MACRO_END_IF:				'endif'                     -> channel(MACRO);
MACRO_LINE:					'__LINE__'                  -> channel(MACRO);
MACRO_FILE:					'__FILE__'                  -> channel(MACRO);
MACRO_COMMA:				','							-> channel(MACRO), type(COMMA);

MACRO_OPEN_PARENS
	: '('
	{
		++ this.parensLevel;
	}
	-> channel(MACRO), type(OPEN_PARENS)
	;

MACRO_CLOSE_PARENS
	: ')'
	{
		-- this.parensLevel;
	}
	-> channel(MACRO), type(CLOSE_PARENS)
	;

MACRO_OPEN_BRACE
	: '{'
	{
		++ this.braceLevel;
	}
	-> channel(MACRO), type(OPEN_BRACE)
	;

MACRO_CLOSE_BRACE
	: '}'
	{
		if (--this.braceLevel === 0) {
			this.isDefineContext = false;
			this.mode(Lexer.DEFAULT_MODE);
		}
	}
	-> channel(MACRO), type(CLOSE_BRACE)
	;

MACRO_SYMBOL
	: [a-zA-Z_][a-zA-Z0-9_#]*
	{
		if (this.parensLevel === 0 && this.braceLevel === 0) {
			if (this.isDefineContext) {
				this.mode(UCLexer.MACRO_TEXT_MODE);
			} else {
				this.mode(Lexer.DEFAULT_MODE);
			}
		}
	}
	-> channel(MACRO)
	;

MACRO_NEW_LINE
	: [\r\n]+
	{
		this.parensLevel = 0;
		this.braceLevel = 0;
		this.isDefineContext = false;
	}
	-> channel(HIDDEN), mode(DEFAULT_MODE)
	;

// MACRO_ERROR: . -> channel(HIDDEN);

mode MACRO_TEXT_MODE;

MACRO_TEXT
	: (~[\n]*? '\\' '\r'? '\n')* ~[\n]+
	-> channel(MACRO)
	;

MACRO_TEXT_NEW_LINE
	: [\r\n]+
	{
		this.parensLevel = 0;
		this.braceLevel = 0;
		this.isDefineContext = false;
	}
	-> channel(HIDDEN), type(MACRO_NEW_LINE), mode(DEFAULT_MODE)
	;