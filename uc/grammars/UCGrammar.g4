grammar UCGrammar;

LINE_COMMENT: '//' ~[\n]+ -> channel(HIDDEN);

BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

WS: [ \t\r\n]+ -> skip;

PP_HASH: '#' ~[\n]+ -> skip;

// Keys
KW_SELF: 'self';

KW_SUPER: 'super';

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

KW_OPERATOR: 'operator';

KW_PREOPERATOR: 'preoperator';

KW_POSTOPERATOR: 'postoperator';

KW_DELEGATE: 'delegate';

KW_FUNCTION: 'function';

KW_EVENT: 'event';

KW_STATE: 'state';

KW_DEFAULT: 'default';

KW_MAP: 'map';

KW_DEFAULTPROPERTIES: 'defaultproperties';

KW_STRUCTDEFAULTPROPERTIES: 'structdefaultproperties';

KW_FOR: 'for';

KW_FOREACH: 'foreach';

KW_RETURN: 'return';

KW_CASE: 'case';

KW_SWITCH: 'switch';

KW_UNTIL: 'until';

KW_DO: 'do';

KW_WHILE: 'while';

KW_ELSE: 'else';

KW_IF: 'if';

KW_IGNORES: 'ignores';

KW_RELIABLE: 'reliable';

KW_UNRELIABLE: 'unreliable';

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

KW_EXTENDS: 'extends' | 'expands';

KW_PUBLIC: 'public';
KW_PROTECTED: 'protected';
KW_PRIVATE: 'private';
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
KW_EDITCONST: 'editconst';
KW_CONFIG: 'config';
KW_NATIVEREPLICATION: 'nativereplication';
KW_GLOBALCONFIG: 'globalconfig';
KW_NATIVE: 'native';
KW_EXPORT: 'export';
KW_ABSTRACT: 'abstract';
KW_PEROBJECTCONFIG: 'perobjectconfig';
KW_PEROBJECTLOCALIZE: 'perobjectlocalize';
KW_PLACEABLE: 'placeable';
KW_NOTPLACEABLE: 'notplaceable';
KW_DEPENDSON: 'dependson';
KW_HIDECATEGORIES: 'hidecategories';
KW_SHOWCATEGORIES: 'showcategories';
KW_TRANSIENT: 'transient';
KW_CACHE: 'cache';
KW_EDITINLINE: 'editinline';
KW_AUTOMATED: 'automated';
KW_TRAVEL: 'travel';
KW_CACHEEXEMPT: 'cacheexempt';
KW_HIDEDROPDOWN: 'hidedropdown';
KW_EXPORTSTRUCTS: 'exportstructs';

ID: [a-zA-Z_][a-zA-Z0-9_]*;

LBRACKET: '[';

RBRACKET: ']';

LBRACE: '{';

RBRACE: '}';

LPARENT: '(';

RPARENT: ')';

LARROW: '<';

RARROW: '>';

EQUALS_SIGN: '=';

COLON: ':';

HASHTAG: '#';

QUESTIONMARK: '?';

SEMICOLON: ';';

COMMA: ',';

SQUOT: '\'';

MINUS: '-';
PLUS: '+';

DECIMAL: (DIGIT 'x' HEX_DIGIT+) | DIGIT+;

FLOAT:
	DIGIT+ DOT DIGIT* EXPONENT?
	| DOT DIGIT+ EXPONENT?
	| DIGIT+ EXPONENT;

DOT: '.';

STRING: '"' (~["\\] | ESC_SEQ)* '"';

NAME: '\'' (~['\\] | ESC_SEQ)* '\'';

ATSIGN: '@';
DOLLARSIGN: '$';
NOTSIGN: '!';
ANDSIGN: '&';
ORSIGN: '|';
MULTIPLYSIGN: '*';
ARROWUPSIGN: '^';
DIVIDESIGN: '/';
MODULUSSIGN: '%';
TILTSIGN: '~';

fragment DIGIT: [0-9];

fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;

fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');

fragment ESC_SEQ:
	'\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');

fragment NEWLINE: [\r\n];

id:
	ID
	| KW_NAME
	| KW_EXTENDS
	| KW_STRING
	| KW_SWITCH
	| KW_CLASS; // FIXME: need to allow most KW but this is ugly and probably inefficient!

// TODO: Rep and def may be anywhere but can only be defined
program:
	classDecl (
		cpptextBlock
		| constDecl
		| (enumDecl SEMICOLON)
		| (structDecl SEMICOLON)
		| varDecl
	)* (( functionDecl | stateDecl | replicationBlock)*) defaultpropertiesBlock?;

//exec
// : HASHTAG NEWLINE ;

typeName: id;

className: id;

stringLiteral: STRING;
nameLiteral: NAME;
booleanLiteral: KW_TRUE | KW_FALSE;

noneLiteral: KW_NONE;

// Maybe leave the post DOT parsing to the expression parsing?
classLiteral: (KW_CLASS | id) SQUOT reference SQUOT (DOT (KW_STATIC | KW_DEFAULT | KW_CONST) DOT)?;

literal: (
		(
			noneLiteral
			| booleanLiteral
			| numeric
			| stringLiteral
			| nameLiteral
		)
		| classLiteral
	);

numeric: DECIMAL | FLOAT;

// Parses the following possiblities.
// Package.Class.Field
// Class.Field
// Class / Field
reference: id (DOT id (DOT id)?)?;

classDecl
	:
		(KW_CLASS | KW_INTERFACE) className
			(
				KW_EXTENDS classExtendsReference
				(KW_WITHIN classWithinReference)?
			)?
			classModifier* SEMICOLON
	;

classReference: reference;

classExtendsReference: classReference;

classWithinReference: classReference;

classModifier:
	KW_NATIVE
	| KW_NATIVEREPLICATION
	| KW_CACHEEXEMPT
	| KW_HIDEDROPDOWN
	| KW_LOCALIZED // ?
	| KW_ABSTRACT
	| KW_PEROBJECTCONFIG
	| KW_PEROBJECTLOCALIZE
	| KW_TRANSIENT
	| KW_EXPORT
	| KW_NOEXPORT
	| KW_EXPORTSTRUCTS
	| KW_PLACEABLE
	| KW_NOTPLACEABLE
	| (KW_CONFIG modifierArgument?)
	| (KW_DEPENDSON modifierArguments)
	| (KW_SHOWCATEGORIES modifierArguments)
	| (KW_HIDECATEGORIES modifierArguments)
	; //ID (LPARENT ID (COMMA ID)* RPARENT)?

// TODO: may be a numeric or typeName!
modifierValue: id;

modifierArgument: LPARENT modifierValue RPARENT;

modifierArguments: LPARENT (modifierValue COMMA?)* RPARENT;

constDecl: KW_CONST constName EQUALS_SIGN constValue SEMICOLON;

constName: id;
constValue: literal;

nativeType: LPARENT .*? RPARENT;

varDecl:
	KW_VAR
		(LPARENT (categoryName (COMMA categoryName)*)? RPARENT)?
		variableModifier*
		variableDeclType
		variable (COMMA variable)*
	//nativeType?
	SEMICOLON;

variable: variableName (arraySize)?;

variableName: id;
categoryName: id;

variableModifier: (
		KW_PUBLIC
		| KW_PROTECTED
		| KW_PRIVATE
		| KW_LOCALIZED
		| KW_NATIVE
		| KW_CONST
		| KW_INIT
		| KW_NOEXPORT
		| KW_EDITCONST
		| KW_CONFIG
		| KW_GLOBALCONFIG
		| KW_TRANSIENT
		| KW_CACHE
		| KW_EXPORT
		| KW_EDITINLINE
		| KW_AUTOMATED
		| KW_TRAVEL
	);

variableType:
	dynArrayType
	| classType
	| mapType
	| primitiveType
	| reference
	;

variableDeclType: (enumDecl | structDecl | variableType);

primitiveType:
	KW_BYTE
	| KW_INT
	| KW_FLOAT
	| KW_BOOL
	| KW_STRING
	| KW_NAME
	| KW_BUTTON // alias for a string with an input modifier
	| KW_CLASS
	; // This is actually a reference but this is necessary because it's a "reserved" keyword.

// TODO: May reference a constant in class or an external enum/const
arraySize: LBRACKET (DECIMAL | reference) RBRACKET;

dynArrayType:
	KW_ARRAY LARROW (
		structDecl
		| enumDecl
		| classType?
		| mapType?
		| primitiveType
		| reference
	) RARROW;

classType: KW_CLASS LARROW classReference RARROW;

mapType:
	KW_MAP LARROW (
		reference
		| (classType | mapType | dynArrayType)
		| primitiveType
	) RARROW;

enumDecl: KW_ENUM enumName LBRACE (valueName COMMA?)* RBRACE;

enumName: id;

valueName: id;

structReference: reference;

structDecl:
	KW_STRUCT nativeType? structModifier* structName (
		KW_EXTENDS structReference
	)? LBRACE (
		constDecl*
		| (enumDecl SEMICOLON)*
		| (structDecl SEMICOLON)*
		| varDecl*
	) cpptextBlock? defaultpropertiesBlock? RBRACE SEMICOLON?;

structName: id;

structModifier: (KW_NATIVE | KW_EXPORT);

cpptextBlock: (KW_CPPTEXT | (KW_STRUCTCPPTEXT | KW_CPPSTRUCT)) LBRACE .*? RBRACE;

replicationBlock:
	KW_REPLICATION LBRACE replicationStatement* RBRACE;

replicationModifier: (KW_RELIABLE | KW_UNRELIABLE);

replicationStatement:
	replicationModifier? KW_IF (LPARENT condition RPARENT) (
		replicateVariableName (COMMA replicateVariableName)* SEMICOLON
	);

replicateVariableName: id;

// public simulated function test(optional int p1, int p2) const; public simulated function
// test(optional int p1, int p2) const { }
functionDecl:
	functionModifier* functionKind
	// We have to identify LPARENT in each, - to prevent a false positive 'operatorName'
	// identification.
	((returnType functionName LPARENT)? | (functionName LPARENT)) (
		functionParam
	)* RPARENT (KW_CONST)? (
		(
			LBRACE
				constDecl* localDecl*
				statement*
			RBRACE
		)
		| SEMICOLON
	);

functionModifier:
	KW_PUBLIC
	| KW_PROTECTED
	| KW_PRIVATE
	| KW_SIMULATED
	| (KW_NATIVE (LPARENT DECIMAL RPARENT)?)
	| KW_FINAL
	| KW_LATENT
	| KW_ITERATOR
	| KW_SINGULAR
	| KW_STATIC
	| KW_EXEC;

// #$@|&!^*-+/%~<>
functionName: id | operatorExpression;

functionParam:
	paramModifier* variableType variable (EQUALS_SIGN expression)? COMMA?;

methodReference : id;

returnType: (variableType);

operatorId:
	(
		DOLLARSIGN
		| ATSIGN
		| HASHTAG
		| EQUALS_SIGN
		| NOTSIGN
		| ANDSIGN
		| ORSIGN
		| ARROWUPSIGN
		| MULTIPLYSIGN
		| MINUS
		| PLUS
		| DIVIDESIGN
		| MODULUSSIGN
		| TILTSIGN
		| LARROW
		| RARROW
	) (
		ORSIGN
		| ANDSIGN
		| ARROWUPSIGN
		| MULTIPLYSIGN
		| MINUS
		| PLUS
		| DIVIDESIGN
		| LARROW
		| RARROW
		| EQUALS_SIGN
	)? (RARROW)?;

paramModifier:
	KW_OUT
	| KW_OPTIONAL
	| KW_INIT
	| KW_SKIP
	| KW_COERCE
	| KW_CONST;

localDecl:
	KW_LOCAL variableType variable (COMMA variable)* SEMICOLON;

labelName: id;

stateReference: reference;

stateDecl: (stateModifier)* KW_STATE (categoryName)? stateName
		(KW_EXTENDS stateReference)?
		LBRACE
			(KW_IGNORES methodReference (COMMA methodReference)* SEMICOLON)?
			(functionDecl)*
			(labelName COLON statement*)*
		RBRACE;

stateName: id;

stateModifier: KW_AUTO | KW_SIMULATED;

codeBody: (codeBlock | statement*);

codeBlock: (LBRACE statement* RBRACE);

statement:
	(
		sm_if
		| sm_else
		| sm_for
		| sm_foreach
		| sm_while
		| sm_do_until
		| sm_switch
		| (sm_return SEMICOLON)
		| (expression SEMICOLON)
	);

// should be EXPR = EXPR but UnrealScript is an exception in that it does - only allow assignments
// as primary statements. Rule: a.b.c.d = 4+5 Invalid: "00" = "1", "00".Length = 1 FIXME: Only
// supports ID = expression
assignment: expression EQUALS_SIGN expression;

condition: expression;

expression:
	expression operatorExpression expression
	| operatorExpression expression
	| expression operatorExpression
	| literal
	| specifier
	| call arrayElement?
	| id arrayElement? // FIXME: KW_CONST in literal context.
	| (LPARENT expression RPARENT);

operatorExpression: DOT | QUESTIONMARK | COLON | operatorId;

specifier:
	KW_SELF
	| KW_STATIC
	| KW_CONST
	| KW_DEFAULT
	| KW_SUPER;

funcSpecifier: (KW_GLOBAL | (KW_SUPER (LPARENT classReference RPARENT)?)) DOT;

arrayElement: (LBRACKET expression RBRACKET);

cast: classType | id;

call: id LPARENT (expression COMMA?)* RPARENT;

sm_if: KW_IF (LPARENT condition RPARENT) codeBody;

sm_else: KW_ELSE statement;

sm_foreach: KW_FOREACH call codeBody;

sm_for:
	KW_FOR (
		LPARENT assignment SEMICOLON condition SEMICOLON expression RPARENT
	) codeBody;

sm_while: KW_WHILE (LPARENT condition RPARENT) codeBody;

sm_do_until:
	KW_DO codeBody KW_UNTIL (LPARENT condition RPARENT);

sm_switch:
	KW_SWITCH (LPARENT expression RPARENT)
	LBRACE?
		((KW_CASE | KW_DEFAULT) literal COLON codeBody)*
	RBRACE?;

sm_return: KW_RETURN expression?;

defaultpropertiesBlock: (
		KW_DEFAULTPROPERTIES
		| KW_STRUCTDEFAULTPROPERTIES
	) LBRACE defaultProperty* RBRACE;

defaultProperty: (
		id (
			(LPARENT DECIMAL RPARENT)
			| (LBRACKET DECIMAL RBRACKET)
		)?
	) EQUALS_SIGN (.*? (SEMICOLON)?);

functionKind: (
		KW_EVENT
		| KW_FUNCTION
		| KW_DELEGATE
		| (KW_OPERATOR (LPARENT DECIMAL RPARENT))
		| (KW_PREOPERATOR)
		| (KW_POSTOPERATOR)
	);