grammar UCGrammar;

LINE_COMMENT
    :   '//' ~[\n]+
		-> channel(HIDDEN)
	;

BLOCK_COMMENT
    :    '/*' .*? '*/'
        -> channel(HIDDEN)
    ;

WS : [ \t\r\n]+ -> channel(HIDDEN);

PP_HASH
	: '#' ~[\n]+
		-> channel(HIDDEN)
	;

// Keys
KW_SELF
    :   'self'
    ;

KW_SUPER
    :   'super'
    ;

KW_GLOBAL
    :   'global'
    ;

KW_CLASS : 'class';

KW_INTERFACE
	:   'interface'
	;

KW_WITHIN
	:   'within'
	;

KW_CONST
	:   'const'
	;
KW_ENUM
	:   'enum'
	;

KW_STRUCT
	:   'struct'
	;

KW_VAR
	:   'var'
	;

KW_LOCAL
	:   'local'
	;

KW_REPLICATION
	:   'replication'
	;

KW_OPERATOR
	:   'operator'
	;

KW_PREOPERATOR
	:   'preoperator'
	;

KW_POSTOPERATOR
	:   'postoperator'
	;

KW_DELEGATE
	:   'delegate'
	;

KW_FUNCTION
    :   'function'
	;

KW_EVENT
	:   'event'
	;

KW_STATE
	:   'state';

KW_DEFAULT
	:   'default';

KW_MAP
	:	'map'
	;

KW_DEFAULTPROPERTIES
	:	'defaultproperties'
	;

KW_STRUCTDEFAULTPROPERTIES
	:	'structdefaultproperties'
	;

KW_FOR
	:	'for'
	;

KW_FOREACH
	:	'foreach'
	;

KW_RETURN
	:	'return'
	;

KW_CASE
	:	'case'
	;

KW_SWITCH
	:	'switch'
	;

KW_UNTIL
	:	'until'
	;

KW_DO
	:	'do'
	;

KW_WHILE
	:	'while'
	;

KW_ELSE
	:	'else'
	;

KW_IF
	:	'if'
	;

KW_IGNORES
	:	'ignores'
	;

KW_RELIABLE
	:	'reliable'
	;

KW_UNRELIABLE
	:	'unreliable'
	;

KW_CPPTEXT
	:	'cpptext'
	;

KW_STRUCTCPPTEXT
	:	'structcpptext'
	;

KW_CPPSTRUCT
	:	'cppstruct'
	;

KW_ARRAY
	:	'array'
	;

KW_BYTE
	:	'byte'
	;

KW_INT
	:	'int'
	;

KW_FLOAT
	:	'float'
	;

KW_STRING
	:	'string'
	;

KW_BUTTON
	:	'button'
	;

KW_BOOL
	:	'bool'
	;

KW_NAME
	:	'name'
	;

KW_TRUE
	:	'true'
	;

KW_FALSE
	:	'false'
	;

KW_NONE
    :   'none'
    ;

KW_EXTENDS
	:	'extends' | 'expands'
	;

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
KW_CACHEEXEMPT : 'cacheexempt';
KW_HIDEDROPDOWN : 'hidedropdown';

ID
	:   [a-zA-Z_][a-zA-Z0-9_]*
	;

LBRACKET
	:	'['
	;

RBRACKET
	:	']'
	;

LBRACE
	:	'{'
	;

RBRACE
	:	'}'
	;

LPARENT
	:	'('
	;

RPARENT
	:	')'
	;

LARROW
	:	'<'
	;

RARROW
	:	'>'
	;

EQUALS_SIGN
	:	'='
	;

COLON
	:	':'
	;

HASHTAG
    :   '#'
    ;

QUESTIONMARK
    :   '?'
    ;

SEMICOLON
	:	';'
	;

COMMA
	:	','
	;

DOT
	:	'.'
	;

SQUOT
    :   '\''
    ;

MINUS: '-';
PLUS: '+';

DECIMAL
    :   (DIGIT 'x' HEX_DIGIT+) | DIGIT+
    ;

FLOAT
    :   DIGIT+ DOT DIGIT* EXPONENT?
        | DOT DIGIT+ EXPONENT?
        | DIGIT+ EXPONENT
    ;

STRING
    :   '"' (~["\\] | ESC_SEQ)* '"'
    ;

NAME
    :   '\'' (~['\\] | ESC_SEQ)* '\''
    ;

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

fragment DIGIT
    :   [0-9]
    ;

fragment EXPONENT
    :   ('e'|'E') ('+'|'-')? DIGIT+
    ;

fragment HEX_DIGIT
    :   (DIGIT|'a'..'f'|'A'..'F')
    ;

fragment ESC_SEQ
    :   '\\' ('b'|'t'|'n'|'r'|'"'|'\''|'\\')
    ;

fragment NEWLINE
    :   [\r\n]
    ;

// TODO: Rep and def may be anywhere but can only be defined
program
    :
        classDecl
		(
			cpptextBlock
			| constDecl
			| (enumDecl SEMICOLON)
			| (structDecl SEMICOLON)
			| varDecl
			| replicationBlock
		)*
        (
			(
				functionDecl
				| stateDecl
				| replicationBlock
			)*
		)
        defaultpropertiesBlock?
    ;

//exec
//    :   HASHTAG NEWLINE
//    ;

typeName
	: ID
	;

className
	: ID
	;

stringLiteral
    :   STRING
    ;
nameLiteral
    :   NAME
    ;
booleanLiteral
    :   KW_TRUE | KW_FALSE
    ;

noneLiteral
    :   KW_NONE
    ;

classLiteral
 	:	(KW_CLASS|ID) SQUOT reference SQUOT
 	;

literal
    :   ((noneLiteral | booleanLiteral | numeric | stringLiteral | nameLiteral) | classLiteral)
    ;

numeric
	:	DECIMAL | FLOAT
	;

reference
    :   typeName (DOT typeName (DOT typeName)?)?
    ;

classDecl
	:	(KW_CLASS | KW_INTERFACE) className (KW_EXTENDS classExtendsReference (KW_WITHIN classWithinReference)?)?
			classModifier* SEMICOLON
	;

classReference
	: 	reference
	;

classExtendsReference
	: 	classReference
	;

classWithinReference
	: 	classReference
	;

classModifier
	:	KW_NATIVE | KW_NATIVEREPLICATION
		| KW_CACHEEXEMPT | KW_HIDEDROPDOWN
		| KW_LOCALIZED // ?
        | KW_ABSTRACT
		| KW_PEROBJECTCONFIG | KW_PEROBJECTLOCALIZE
        | KW_TRANSIENT
		| KW_EXPORT | KW_NOEXPORT
		| KW_PLACEABLE | KW_NOTPLACEABLE
		| (KW_CONFIG modifierArgument?)
		| (KW_DEPENDSON modifierArguments)
		| (KW_SHOWCATEGORIES modifierArguments)
		| (KW_HIDECATEGORIES modifierArguments)
        //ID (LPARENT ID (COMMA ID)* RPARENT)?
	;

// TODO: may be a numeric or typeName!
modifierValue
	: ID
	;

modifierArgument
	: LPARENT modifierValue RPARENT
	;

modifierArguments
	: LPARENT (modifierValue COMMA?)* RPARENT
	;

constDecl
	:	KW_CONST constName EQUALS_SIGN constValue SEMICOLON
	;

constName
    :   ID
    ;
constValue
    :   literal
    ;

nativeType
	:	LPARENT .*? RPARENT
	;

variable
	:	variableName (arraySize)?
	;

variableName
    :   ID
    ;

varDecl
	:	KW_VAR (LPARENT (categoryName (COMMA categoryName)*)? RPARENT)?
        variableModifier*
        (enumDecl? | structDecl? | variableType)
        variable (COMMA variable)*
        //nativeType?
        SEMICOLON
    ;

variableModifier
	:	(KW_PUBLIC | KW_PROTECTED | KW_PRIVATE
        | KW_LOCALIZED | KW_NATIVE | KW_CONST
        | KW_INIT | KW_NOEXPORT | KW_EDITCONST
        | KW_CONFIG | KW_GLOBALCONFIG | KW_TRANSIENT | KW_CACHE | KW_EXPORT | KW_EDITINLINE | KW_AUTOMATED)
	;

categoryName
	:	ID
	;

variableType
    :   dynArrayType | classType | primitiveType | reference | mapType
    ;

primitiveType
	:	(
            KW_BYTE | KW_INT | KW_FLOAT | KW_STRING | KW_BOOL | KW_NAME
            | KW_BUTTON // alias for a string with an input modifier
            | KW_CLASS // This is actually a reference but this is necessary because it's a "reserved" keyword.
        )
	;

// TODO: Add const and enum support
arraySize
	:	LBRACKET (DECIMAL | reference) RBRACKET
	;

dynArrayType
	:	KW_ARRAY LARROW (reference | (classType | mapType) | primitiveType) RARROW
	;

classType
	:	KW_CLASS LARROW reference RARROW
	;

mapType
	:	KW_MAP LARROW (reference | (classType | mapType | dynArrayType) | primitiveType) RARROW
	;

enumDecl
	:	KW_ENUM enumName
		LBRACE
			(valueName COMMA?)*
		RBRACE
	;

enumName
    :   ID
    ;

valueName
    :   ID
    ;

structReference
	: reference
	;

structDecl
	:	KW_STRUCT nativeType? structModifier* structName (KW_EXTENDS structReference)?
        LBRACE
        	(constDecl*
            |(enumDecl SEMICOLON)*
            |(structDecl SEMICOLON)*
            |varDecl*)

            cpptextBlock?
        	defaultpropertiesBlock?
        RBRACE SEMICOLON?
    ;

structName
    :   ID
    ;

structModifier
	:	(KW_NATIVE | KW_EXPORT)
	;

cpptextBlock
	:	(KW_CPPTEXT | (KW_STRUCTCPPTEXT | KW_CPPSTRUCT))
		LBRACE
            .*?
		RBRACE
	;

replicationBlock
	:	KW_REPLICATION
		LBRACE
			((KW_RELIABLE | KW_UNRELIABLE)? KW_IF LPARENT expression RPARENT
				ID (COMMA ID)* SEMICOLON)*
		RBRACE
	;

// public simulated function test(optional int p1, int p2) const;
// public simulated function test(optional int p1, int p2) const
// {
// }
functionDecl
	:	functionModifier*
        functionKind
			// We have to identify LPARENT in each,
			// - to prevent a false positive 'operatorName' identification.
			((returnType functionName LPARENT)? | (functionName LPARENT))
				(functionParam)*
            RPARENT
            (KW_CONST)?
		((
			LBRACE
				constDecl*
				localDecl*

				// methodBody
			RBRACE
		) | SEMICOLON)
	;


functionModifier
    :   KW_PUBLIC | KW_PROTECTED | KW_PRIVATE
        |KW_SIMULATED
		|(KW_NATIVE (LPARENT DECIMAL RPARENT)?)
        |KW_FINAL
        |KW_LATENT
        |KW_ITERATOR
        |KW_SINGULAR
        |KW_STATIC
		|KW_EXEC
    ;

// #$@|&!^*-+/%~<>
functionName
    :   ID | operatorName
    ;

functionParam
	: paramModifier* variableType variable (EQUALS_SIGN expression)? COMMA?
	;

returnType
    :   (variableType)
    ;

operatorId
	:
		(DOLLARSIGN|ATSIGN|HASHTAG|EQUALS_SIGN|NOTSIGN|ANDSIGN|ORSIGN|ARROWUPSIGN|MULTIPLYSIGN|MINUS|PLUS|DIVIDESIGN|MODULUSSIGN|TILTSIGN|LARROW|RARROW)
        (ORSIGN|ANDSIGN|ARROWUPSIGN|MULTIPLYSIGN|MINUS|PLUS|DIVIDESIGN|LARROW|RARROW|EQUALS_SIGN)?
	;

operatorName
    :   (
            (QUESTIONMARK | COLON)
            |(
                (operatorId)?
                RARROW?
            )
            |ID
        )
    ;

paramModifier
    :   KW_OUT | KW_OPTIONAL | KW_INIT | KW_SKIP | KW_COERCE | KW_CONST
    ;

localDecl
    :   KW_LOCAL variableType variable (COMMA variable)* SEMICOLON
    ;

stateReference
	: reference
	;

stateDecl
	:	(stateModifier)* KW_STATE (categoryName)? stateName (KW_EXTENDS stateReference)?
		LBRACE
			(KW_IGNORES ID (COMMA ID)* SEMICOLON)?

			(functionDecl)*

			(ID COLON statement*)*
		RBRACE
	;

stateName
    :   ID
    ;

stateModifier
	:	KW_AUTO | KW_SIMULATED
	;

methodBody
	:	statement*
	;

codeBody
    :   (codeBlock | statement*)
    ;

codeBlock
	:	(LBRACE statement* RBRACE)
	;

statement
	:
		(
			sm_if
			|sm_else
			|sm_for
			|sm_foreach
			|sm_while
			|sm_do_until
			|sm_switch
			|sm_return
			|expression
		)
		SEMICOLON
	;

// should be EXPR = EXPR but UnrealScript is an exception in that it does
// - only allow assignments as primary statements.
// Rule: a.b.c.d = 4+5
// Invalid: "00" = "1", "00".Length = 1
// FIXME: Only supports ID = expression
assignment
	:	expression EQUALS_SIGN expression
	;

condition
    :   expression
    ;

expression
    :
        |(LPARENT expression RPARENT)
        |codeContext
        |operatorCall
        |call
        // |(cast? (LPARENT expression RPARENT)) // cast
    ;

specifier
    :   KW_SELF | KW_STATIC | KW_CONST | KW_DEFAULT | KW_SUPER
    ;

funcSpecifier
    :   (KW_GLOBAL | (KW_SUPER (LPARENT ID RPARENT)?)) DOT
    ;

exprtest
    :   (specifier DOT)? (((funcSpecifier DOT)? call) | ID) arrayElement?
    ;

arrayElement
    :   (LBRACKET expression RBRACKET)
    ;

codeContext: literal | (exprtest (DOT exprtest)?);

cast
    :   classType | ID
    ;

binaryOperator
    :  codeContext operatorName codeContext
    ;

preOperator
    :   operatorName codeContext
    ;

postOperator
    :   codeContext operatorName
    ;

operatorCall
    :   binaryOperator | preOperator | postOperator
    ;

call
	:   ID LPARENT expression RPARENT
	;

sm_if
	:	KW_IF (LPARENT condition RPARENT)
			codeBody
	;

sm_else
    : 	KW_ELSE statement
    ;

sm_foreach
	:	KW_FOREACH call
			codeBody
	;

sm_for
	:	KW_FOR (LPARENT assignment SEMICOLON condition SEMICOLON expression RPARENT)
			codeBody
	;

sm_while
	:	KW_WHILE (LPARENT condition RPARENT)
			codeBody
	;

sm_do_until
	:	KW_DO
			codeBody
		KW_UNTIL (LPARENT condition RPARENT)
	;

sm_switch
	:	KW_SWITCH (LPARENT expression RPARENT)
		LBRACE
			(KW_CASE literal COLON
				codeBlock
			)*?

			(KW_DEFAULT COLON
				codeBlock
			)?
		RBRACE
	;

sm_return
	:	KW_RETURN (expression)
	;

defaultpropertiesBlock
	:	(KW_DEFAULTPROPERTIES | KW_STRUCTDEFAULTPROPERTIES)
		LBRACE
            defaultProperty*
		RBRACE
	;

defaultProperty
    :   (ID((LPARENT DECIMAL RPARENT) | (LBRACKET DECIMAL RBRACKET))?)
        EQUALS_SIGN
        (.*? (SEMICOLON)?)
    ;

functionKind
    :   (KW_EVENT | KW_FUNCTION | KW_DELEGATE
        | (KW_OPERATOR (LPARENT DECIMAL RPARENT))
        | (KW_PREOPERATOR)
        | (KW_POSTOPERATOR))
    ;