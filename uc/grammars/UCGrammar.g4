grammar UCGrammar;

@parser::members {
	keyword(kw) {
		return this.currentToken.text == kw;
	}
}

LINE_COMMENT: '//' ~[\n]+ -> channel(HIDDEN);

BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

PP_HASH: '#' ~[\n]+ -> skip;
PP_TICK: '`' ~[\n]+ -> skip;

WS: [ \t\r\n]+ -> skip;

// Keys
kwSELF: { this.keyword('self') }? ID;
kwSUPER: { this.keyword('super') }? ID;
kwGLOBAL: { this.keyword('global') }? ID;
kwCLASS: { this.keyword('class') }? ID;

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

kwEVENT: { this.keyword('event') }? ID;

kwSTATE: { this.keyword('state') }? ID;

KW_DEFAULT: 'default';

kwMAP: { this.keyword('map') }? ID;

KW_DEFAULTPROPERTIES: 'defaultproperties';

KW_STRUCTDEFAULTPROPERTIES: 'structdefaultproperties';

KW_FOR: 'for';

KW_FOREACH: 'foreach';

KW_RETURN: 'return';

kwCASE: { this.keyword('case') }? ID;

kwSWITCH: { this.keyword('switch') }? ID;

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

kwBYTE: { this.keyword('byte') }? ID;

kwINT: { this.keyword('int') }? ID;

kwFLOAT: { this.keyword('float') }? ID;

kwSTRING: { this.keyword('string') }? ID;

kwButton: { this.keyword('button') }? ID;

kwBOOL: { this.keyword('bool') }? ID;

kwName: { this.keyword('name') }? ID;

KW_TRUE: 'true';

KW_FALSE: 'false';

KW_NONE: 'none';

KW_EXTENDS: 'extends' | 'expands';

KW_PUBLIC: 'public';
KW_PROTECTED: 'protected';
KW_PROTECTEDWRITE: 'protectedwrite';
KW_PRIVATE: 'private';
KW_PRIVATEWRITE: 'privatewrite';
KW_LOCALIZED: 'localized';
kwOUT: { this.keyword('out') }? ID;
KW_OPTIONAL: 'optional';
kwINIT: { this.keyword('init') }? ID;
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
KW_NATIVE: 'native' | 'intrinsic';
KW_NATIVEREPLICATION: 'nativereplication';
KW_NATIVEONLY: 'nativeonly';
KW_EXPORT: 'export';
KW_ABSTRACT: 'abstract';
KW_PEROBJECTCONFIG: 'perobjectconfig';
KW_PEROBJECTLOCALIZED: 'perobjectlocalized';
KW_PLACEABLE: 'placeable';
KW_NOUSERCREATE: 'nousercreate';
KW_NOTPLACEABLE: 'notplaceable';
KW_SAFEREPLACE: 'safereplace';
KW_DEPENDSON: 'dependson';
KW_SHOWCATEGORIES: 'showcategories';
KW_HIDECATEGORIES: 'hidecategories';
kwGUID: { this.keyword('guid') }? ID;
kwLONG: { this.keyword('long') }? ID;
KW_TRANSIENT: 'transient';
KW_NONTRANSIENT: 'nontransient';
KW_CACHE: 'cache';
KW_INTERP: 'interp';
KW_REPRETRY: 'repretry';
KW_REPNOTIFY: 'repnotify';
KW_NOTFORCONSOLE: 'notforconsole';
KW_ARCHETYPE: 'archetype';
KW_CROSSLEVELACTIVE: 'crosslevelactive';
KW_CROSSLEVELPASSIVE: 'crosslevelpassive';
KW_AUTOMATED: 'automated';
KW_TRAVEL: 'travel';
kwInput: { this.keyword('input') }? ID;
KW_CACHEEXEMPT: 'cacheexempt';
KW_HIDEDROPDOWN: 'hidedropdown';
KW_INSTANCED: 'instanced';
KW_DATABINDING: 'databinding';
KW_DUPLICATETRANSIENT: 'duplicatetransient';
KW_PARSECONFIG: 'parseconfig';
KW_EDITINLINENEW: 'editinlinenew';
KW_NOTEDITINLINENEW: 'noteditinlinenew';
KW_EXPORTSTRUCTS: 'exportstructs';
KW_DLLBIND: 'dllbind';
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

KW_COLLAPSECATEGORIES: 'collapsecategories';
KW_DONTCOLLAPSECATEGORIES: 'dontcollapsecategories';
KW_IMPLEMENTS: 'implements';
KW_CLASSGROUP: 'classgroup';
KW_AUTOEXPANDCATEGORIES: 'autoexpandcategories';
KW_AUTOCOLLAPSECATEGORIES: 'autocollapsecategories';
KW_DONTAUTOCOLLAPSECATEGORIES: 'dontautocollapsecategories';
KW_DONTSORTCATEGORIES: 'dontsortcategories';
KW_INHERITS: 'KW_INHERITS';
KW_FORCESCRIPTORDER: 'forcescriptorder';

ID: [a-zA-Z_][a-zA-Z0-9_]*;

LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LBRACKET: '[';
RBRACKET: ']';
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

INTEGER: (DIGIT 'x' HEX_DIGIT+) | DIGIT+;

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

fragment DIGIT: [0-9]('f' | 'F')?;

fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;

fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');

fragment ESC_SEQ:
	'\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');

fragment NEWLINE: [\r\n];

// TODO: Rep and def may be anywhere but can only be defined
program:
	classDecl (
		cpptextBlock
		| constDecl
		| (enumDecl SEMICOLON?)
		| (structDecl)
		| varDecl
	)* (( functionDecl | stateDecl | replicationBlock)*) defaultpropertiesBlock?;

//exec
// : HASHTAG NEWLINE ;

typeName: ID;

className: ID;

stringLiteral: STRING;
nameLiteral: NAME;
booleanLiteral: KW_TRUE | KW_FALSE;

noneLiteral: KW_NONE;

// Maybe leave the post DOT parsing to the expression parsing?
// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
classLiteral: ID nameLiteral (DOT (KW_STATIC | KW_DEFAULT | KW_CONST) DOT)?;

literal: (
		(
			noneLiteral
			| booleanLiteral
			| numeric
			| stringLiteral
			| nameLiteral
		)
		| classLiteral
		| reference // e.g. a constant or enum name
	);

numeric: INTEGER | FLOAT;

// Parses the following possiblities.
// Package.Class.Field
// Class.Field
// Class / Field
reference: ID (DOT ID (DOT ID)?)?;

classDecl
	:
		(kwCLASS | KW_INTERFACE) className
			(
				KW_EXTENDS classExtendsReference
				// UC2+
				(KW_WITHIN classWithinReference)?
			)?
			classModifier* SEMICOLON
	;

classReference: reference;

classExtendsReference: classReference;

classWithinReference: classReference;

classModifier:
	// in UC3 a class can have a custom native name.
	(KW_NATIVE modifierArgument?)
	| KW_NATIVEREPLICATION
	| KW_LOCALIZED // UC1
	| KW_ABSTRACT
	| KW_PEROBJECTCONFIG
	| KW_TRANSIENT
	| KW_EXPORT
	| KW_NOEXPORT
	| KW_NOUSERCREATE
	| KW_SAFEREPLACE
	| (KW_CONFIG modifierArgument?)
	// UC2+
	| KW_PLACEABLE
	| KW_NOTPLACEABLE
	| KW_CACHEEXEMPT // UT2004
	| KW_HIDEDROPDOWN
	| KW_EXPORTSTRUCTS
	| KW_INSTANCED
	| KW_PARSECONFIG
	| KW_EDITINLINENEW
	| KW_NOTEDITINLINENEW
	| (KW_DEPENDSON modifierArguments)
	| (KW_COLLAPSECATEGORIES modifierArguments)
	| (KW_DONTCOLLAPSECATEGORIES modifierArguments?)
	| (KW_SHOWCATEGORIES modifierArguments)
	| (KW_HIDECATEGORIES modifierArguments)
	| (kwGUID (LPAREN INTEGER COMMA INTEGER COMMA INTEGER COMMA INTEGER RPAREN))
	// UC3+
	| KW_NATIVEONLY
	| KW_NONTRANSIENT
	| KW_PEROBJECTLOCALIZED
	| KW_DEPRECATED
	| (KW_DLLBIND modifierArgument)
	| (KW_IMPLEMENTS modifierArgument)
	| (KW_CLASSGROUP modifierArguments)
	| (KW_AUTOEXPANDCATEGORIES modifierArguments)
	| (KW_AUTOCOLLAPSECATEGORIES modifierArguments)
	| (KW_DONTAUTOCOLLAPSECATEGORIES modifierArguments)
	| (KW_DONTSORTCATEGORIES modifierArguments)
	| (KW_INHERITS modifierArguments)
	// true/false only
	| (KW_FORCESCRIPTORDER modifierArgument)
	; //ID (LPARENT ID (COMMA ID)* RPARENT)?

// TODO: may be a numeric or typeName!
modifierValue: ID;

modifierArgument: LPAREN modifierValue RPAREN;

modifierArguments: LPAREN (modifierValue COMMA?)* RPAREN;

constDecl: KW_CONST constName EQUALS_SIGN constValue SEMICOLON;

constName: ID;
constValue: literal;

varDecl:
	KW_VAR
		(LPAREN (categoryName (COMMA categoryName)*)? RPAREN)?
		variableModifier*
		variableDeclType
		variable nativeType? variableMeta? (COMMA variable)*
	SEMICOLON;

variable: variableName (arraySize)?;

// <UIMin=0.0,UIMax=1.0,Toolip="Hello">
variableMeta: LARROW .*? RARROW;

variableName: ID;
categoryName: ID;

// UC3 CPP specifier e.g. {public}
nativeSpecifier: LBRACE nativeSpecifier RBRACE;

// UC3 CPP type e.g. {QWORD}
nativeType: LBRACE ID RBRACE;

variableModifier
	: (
		KW_PUBLIC
		| KW_PROTECTED
		| KW_PROTECTEDWRITE
		| KW_PRIVATE
		| KW_PRIVATEWRITE
		| KW_LOCALIZED
		| KW_NATIVE
		| KW_CONST
		| KW_EDITCONST
		| KW_CONFIG
		| KW_GLOBALCONFIG
		| KW_TRANSIENT
		| KW_TRAVEL
		| kwInput
		// UC2
		| KW_EXPORT
		| KW_NOEXPORT
		| KW_CACHE
		| KW_AUTOMATED
		| KW_EDITINLINE
		| KW_EDITINLINENOTIFY
		| KW_EDITCONSTARRAY
		| KW_EDFINDABLE
		// UC3
		| kwINIT
		| KW_EDITFIXEDSIZE
		| KW_EDITORONLY
		| KW_EDITORTEXTBOX
		| KW_NOCLEAR
		| KW_NOIMPORT
		| KW_SERIALIZETEXT
		| KW_NONTRANSACTIONAL
		| KW_INSTANCED
		| KW_DATABINDING
		| KW_DUPLICATETRANSIENT
		| KW_REPRETRY
		| KW_REPNOTIFY
		| KW_INTERP
		| KW_DEPRECATED
		| KW_NOTFORCONSOLE
		| KW_ARCHETYPE
		| KW_CROSSLEVELACTIVE
		| KW_CROSSLEVELPASSIVE
	) nativeSpecifier?
	;

variableType:
	dynArrayType
	| classType
	| mapType
	| primitiveType
	| reference
	;

variableDeclType: (enumDecl | structDecl | variableType);

primitiveType:
	kwBYTE
	| kwINT
	| kwFLOAT
	| kwBOOL
	| kwSTRING
	| kwName
	| kwButton // alias for a string with an input modifier
	| kwCLASS
	; // This is actually a reference but this is necessary because it's a "reserved" keyword.

// TODO: May reference a constant in class or an external enum/const
arraySize: LBRACKET (INTEGER | reference) RBRACKET;

dynArrayType:
	KW_ARRAY LARROW (
		structDecl
		| enumDecl
		| classType?
		| mapType?
		| primitiveType
		| reference
	) RARROW;

classType: kwCLASS LARROW classReference RARROW;

mapType:
	kwMAP LARROW (
		reference
		| (classType | mapType | dynArrayType)
		| primitiveType
	) RARROW;

enumDecl:
	KW_ENUM enumName
	LBRACE
		(valueName COMMA?)*
	RBRACE
	;

enumName: ID;

valueName: ID;

structReference: reference;

structDecl:
	KW_STRUCT nativeType? structModifier* structName (
		KW_EXTENDS structReference
	)?
	LBRACE
		(
			constDecl
			| (enumDecl SEMICOLON?)
			| (structDecl)
			| varDecl
		)*
		cpptextBlock?
		defaultpropertiesBlock?
	RBRACE SEMICOLON?;

structName: ID;

structModifier
	:
	(
		// UC2+
		KW_NATIVE
		| KW_TRANSIENT
		| KW_EXPORT
		| kwINIT
		| kwLONG
		// UC3+
		| KW_STRICTCONFIG
		| KW_ATOMIC
		| KW_ATOMICWHENCOOKED
		| KW_IMMUTABLE
		| KW_IMMUTABLEWHENCOOKED
	)
	;

cpptextBlock: (KW_CPPTEXT | (KW_STRUCTCPPTEXT | KW_CPPSTRUCT)) LBRACE .*? RBRACE;

replicationBlock:
	KW_REPLICATION LBRACE replicationStatement* RBRACE;

replicationModifier: (KW_RELIABLE | KW_UNRELIABLE);

replicationStatement:
	replicationModifier? KW_IF (LPAREN condition RPAREN) (
		replicateVariableName (COMMA replicateVariableName)* SEMICOLON
	);

replicateVariableName: ID;

// public simulated function test(optional int p1, int p2) const; public simulated function
// test(optional int p1, int p2) const { }
functionDecl:
	functionModifier* functionKind
	// We have to identify LPARENT in each, - to prevent a false positive 'operatorName'
	// identification.
	// TODO: are multiple returnModifiers a thing?
	((returnModifier? returnType functionName LPAREN)? | (functionName LPAREN))
		paramDecl*
	RPAREN (KW_CONST)? (
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
	| (KW_NATIVE (LPAREN INTEGER RPAREN)?)
	| KW_FINAL
	| KW_LATENT
	| KW_ITERATOR
	| KW_SINGULAR
	| KW_STATIC
	| KW_EXEC
	// UC3
	| KW_CONST
	| KW_NOEXPORT
	| KW_NOEXPORTHEADER
	| KW_VIRTUAL
	| KW_RELIABLE
	| KW_UNRELIABLE
	| KW_SERVER
	| KW_CLIENT
	| KW_DLLIMPORT
	| KW_DEMORECORDING;

// #$@|&!^*-+/%~<>
functionName: ID | operatorId;

paramDecl:
	paramModifier* variableType variable (EQUALS_SIGN expression)? COMMA?;

methodReference : ID;

returnModifier: KW_COERCE;
returnType: (variableType);

operatorId
	:
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
	)
	(
		EQUALS_SIGN
		| ANDSIGN
		| ORSIGN
		| ARROWUPSIGN
		| MULTIPLYSIGN
		| MINUS
		| PLUS
		| DIVIDESIGN
		| LARROW
		| RARROW
	)?
	(RARROW)?
	;

paramModifier:
	kwOUT
	| KW_OPTIONAL
	| kwINIT
	| KW_SKIP
	| KW_COERCE
	| KW_CONST;

localDecl:
	KW_LOCAL variableType variable (COMMA variable)* SEMICOLON;

labelName: ID;

stateReference: reference;

stateDecl: (stateModifier)* kwSTATE (LPAREN RPAREN)? stateName
		(KW_EXTENDS stateReference)?
		LBRACE
			(KW_IGNORES methodReference (COMMA methodReference)* SEMICOLON)?
			(functionDecl)*
			(labelName COLON statement*)*
		RBRACE;

stateName: ID;

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
	| call arrayElement? expression? // HACK for special operators
	| ID arrayElement? // FIXME: KW_CONST in literal context.
	| (LPAREN expression RPAREN);

operatorExpression: DOT | QUESTIONMARK | COLON | ID | operatorId;

specifier:
	kwSELF
	| KW_STATIC
	| KW_CONST
	| KW_DEFAULT
	| kwSUPER;

funcSpecifier: (kwGLOBAL | (kwSUPER (LPAREN classReference RPAREN)?)) DOT;

arrayElement: (LBRACKET expression RBRACKET);

cast: classType | ID;

call: ID LPAREN (COMMA* expression)* RPAREN;

sm_if: KW_IF (LPAREN condition RPAREN) codeBody;

sm_else: KW_ELSE codeBody;

sm_foreach: KW_FOREACH call codeBody;

sm_for:
	KW_FOR (
		LPAREN assignment SEMICOLON condition SEMICOLON expression RPAREN
	) codeBody;

sm_while: KW_WHILE (LPAREN condition RPAREN) codeBody;

sm_do_until:
	KW_DO codeBody KW_UNTIL (LPAREN condition RPAREN);

sm_switch:
	kwSWITCH (LPAREN expression RPAREN)
	LBRACE?
		((kwCASE | KW_DEFAULT) literal COLON codeBody)*
	RBRACE?;

sm_return: KW_RETURN expression?;

defaultpropertiesBlock
	:
		(KW_DEFAULTPROPERTIES | KW_STRUCTDEFAULTPROPERTIES)
		LBRACE
			defaultProperty*
		RBRACE
	;

defaultProperty: (
		ID (
			(LPAREN INTEGER RPAREN)
			| (LBRACKET INTEGER RBRACKET)
		)?
	) EQUALS_SIGN (.*? (SEMICOLON)?);

functionKind: (
		kwEVENT
		| KW_FUNCTION
		| KW_DELEGATE
		| (KW_OPERATOR (LPAREN INTEGER RPAREN))
		| (KW_PREOPERATOR)
		| (KW_POSTOPERATOR)
	);