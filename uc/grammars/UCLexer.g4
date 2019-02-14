lexer grammar UCLexer;

fragment DIGIT: [0-9];
fragment DIGITF: [0-9fF];
fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;
fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');
fragment ESC_SEQ:
	'\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');

LINE_COMMENT: '//' ~[\r\n]* -> channel(HIDDEN);
BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

DIRECTIVE: '#' ('exec'|'include'|'error'|'call'|'linenumber') .*? ~[\r\n]+ -> channel(HIDDEN);
// PP_TICK: '`' ~[\n] -> channel(HIDDEN);

WS: [ \t\r\n\u000C]+ -> skip;

STRING: '"' (~["\\] | ESC_SEQ)* '"';
NAME: '\'' (~['\\] | ESC_SEQ)* '\'';

ID:	[a-zA-Z_][a-zA-Z0-9_]*;
// ID:	[a-z_][a-z0-9_]*;

OPEN_PARENS: '(';
CLOSE_PARENS: ')';

OPEN_BRACE: '{';
CLOSE_BRACE: '}';

OPEN_BRACKET: '[';
CLOSE_BRACKET: ']';

LT: '<';
GT: '>';

ASSIGNMENT: '=';
COLON: ':';
SHARP: '#';
INTERR: '?';
SEMICOLON: ';';
COMMA: ',';
SQUOT: '\'';
MINUS: '-';
PLUS: '+';
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

INTEGER: (DIGIT 'x' HEX_DIGIT+) | (DIGIT+ ('f'| 'F')*);

FLOAT: (DIGIT+ DOT DIGITF* EXPONENT?)
	| (DIGIT+ DIGITF* EXPONENT);