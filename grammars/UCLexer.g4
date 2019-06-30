lexer grammar UCLexer;

fragment DIGIT: [0-9];
fragment DIGITF: [0-9fF];
fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;
fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');
fragment ESC_SEQ: '\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');

LINE_COMMENT
	: '//' ~[\r\n]*
	-> channel(HIDDEN)
	;

BLOCK_COMMENT
	: '/*' .*? '*/'
	-> channel(HIDDEN)
	;

WS
	: [ \t\r\n]+
	-> skip
	;

PP: '`';

PP_MACRO
	: PP WS?
		( MACRO_BLOCK
		| MACRO_DEFINE
		| MACRO_CALL
		)
	-> channel(HIDDEN)
	;

fragment PARENTHESES: '(' (~')' | PARENTHESES)* ')';

fragment MACRO_BLOCK
	: '{' ~'}'* '}'
	;

fragment MACRO_DEFINE
	: 'define' WS MACRO_DEFINTION?
	;

// TODO: Multiline macros, defined by a backslash \
fragment MACRO_DEFINTION
	: ~[\r\n]+
	;

fragment MACRO_CALL
	: MACRO_NAME PARENTHESES?
	;

fragment MACRO_NAME
	: ID
	;

STRING: '"' (~["\\] | ESC_SEQ)* '"';
NAME: '\'' (~['\\] | ESC_SEQ)* '\'';

KW_FUNCTION: 'function';
KW_EVENT: 'event';
KW_DELEGATE: 'delegate';
KW_OPERATOR: 'operator';
KW_PREOPERATOR: 'preoperator';
KW_POSTOPERATOR: 'postoperator';
KW_CONST: 'const';
KW_FINAL: 'final';
KW_STATIC: 'static';
KW_NATIVE: 'native';
KW_PUBLIC: 'public';
KW_PROTECTED: 'protected';
KW_PRIVATE: 'private';

// Note: Keywords must precede the ID token.
ID:	[a-zA-Z_][a-zA-Z0-9_]*;
// ID:	[a-z_][a-z0-9_]*;

ESCAPE: '\\';

INTEGER
	: (DIGIT 'x' HEX_DIGIT+)
	| (DIGIT+ ('f'| 'F')*)
	;

FLOAT
	: (DIGIT+ DOT DIGITF* EXPONENT?)
	| (DIGIT+ DIGITF* EXPONENT)
	;

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
PERCENT: '%';
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