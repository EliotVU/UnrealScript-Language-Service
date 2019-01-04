grammar UCGrammar;

fragment DIGIT: [0-9]('f' | 'F')?;
fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;
fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');
fragment ESC_SEQ:
	'\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');
fragment NEWLINE: [\r\n];

LINE_COMMENT: '//' ~[\n]+ -> channel(HIDDEN);

BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

// PP_HASH: '#' .*? ~[\n]+ -> channel(HIDDEN);
PP_TICK: '`' ~[\n] -> skip;

WS: [ \t\r\n]+ -> skip;

// ID:	[a-zA-Z_][a-zA-Z0-9_]*;
ID:	[a-z_][a-z0-9_]*;

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

kwDEFAULT: 'default';
kwSELF: 'self';
kwSUPER: 'super';
kwGLOBAL: 'global';
kwCLASS: 'class';

kwINTERFACE: 'interface';
kwWITHIN: 'within';
kwCONST: 'const';
kwENUM: 'enum';
kwSTRUCT: 'struct';
kwVAR: 'var';
kwLOCAL: 'local';
kwREPLICATION: 'replication';
kwOPERATOR: 'operator';
kwPREOPERATOR: 'preoperator';
kwPOSTOPERATOR: 'postoperator';

kwDELEGATE: 'delegate';
kwFUNCTION: 'function';

kwEVENT: 'event';
kwSTATE: 'state';

kwMAP: 'map';
kwDEFAULTPROPERTIES: 'defaultproperties' | 'structdefaultproperties';

kwFOR: 'for';
kwFOREACH: 'foreach';
kwRETURN: 'return';
kwBREAK: 'break';
kwCONTINUE: 'continue';
kwSTOP: 'stop';
kwCASE: 'case';
kwSWITCH: 'switch';
kwUNTIL: 'until';
kwDO: 'do';
kwWHILE: 'while';
kwELSE: 'else';
kwIF: 'if';

kwIGNORES: 'ignores';
kwUNRELIABLE: 'unreliable';
kwRELIABLE: 'reliable';

kwCPPTEXT: 'cpptext';
kwSTRUCTCPPTEXT: 'structcpptext';
kwCPPSTRUCT: 'cppstruct';

kwARRAY: 'array';
kwBYTE: 'byte';
kwINT: 'int';
kwFLOAT: 'float';
kwSTRING: 'string';
kwButton: 'button';
kwBOOL: 'bool';
kwNAME: 'name';
kwTRUE: 'true';
kwFALSE: 'false';
kwNONE: 'none';

kwEXTENDS: 'extends' | 'expands';

kwPUBLIC: 'public';
kwPROTECTED: 'protected';
kwPROTECTEDWRITE: 'protectedwrite';
kwPRIVATE: 'private';
kwPRIVATEWRITE: 'privatewrite';
kwLOCALIZED: 'localized';
kwOUT: 'out';
kwOPTIONAL: 'optional';
kwINIT: 'init';
kwSKIP: 'skip';
kwCOERCE: 'coerce';
kwFINAL: 'final';
kwLATENT: 'latent';
kwSINGULAR: 'singular';
kwSTATIC: 'static';
kwEXEC: 'exec';
kwITERATOR: 'iterator';
kwSIMULATED: 'simulated';
kwAUTO: 'auto';
kwNOEXPORT: 'noexport';
kwNOEXPORTHEADER: 'noexportheader';
kwEDITCONST: 'editconst';
kwEDFINDABLE: 'edfindable';
kwEDITINLINE: 'editinline';
kwEDITINLINENOTIFY: 'editinlinenotify';
kwEDITHIDE: 'edithide';
kwEDITCONSTARRAY: 'editconstarray';
kwEDITFIXEDSIZE: 'editfixedsize';
kwEDITORONLY: 'editoronly';
kwEDITORTEXTBOX: 'editortextbox';
kwNOCLEAR: 'noclear';
kwNOIMPORT: 'noimport';
kwNONTRANSACTIONAL: 'nontransactional';
kwSERIALIZETEXT: 'serializetext';
kwCONFIG: 'config';
kwGLOBALCONFIG: 'globalconfig';
kwNATIVE: 'native' | 'intrinsic';
kwNATIVEREPLICATION: 'nativereplication';
kwNATIVEONLY: 'nativeonly';
kwEXPORT: 'export';
kwABSTRACT: 'abstract';
kwPEROBJECTCONFIG: 'perobjectconfig';
kwPEROBJECTLOCALIZED: 'perobjectlocalized';
kwPLACEABLE: 'placeable';
kwNOUSERCREATE: 'nousercreate';
kwNOTPLACEABLE: 'notplaceable';
kwSAFEREPLACE: 'safereplace';
kwDEPENDSON: 'dependson';
kwSHOWCATEGORIES: 'showcategories';
kwHIDECATEGORIES: 'hidecategories';
kwGUID: 'guid';
kwLONG: 'long';
kwTRANSIENT: 'transient';
kwNONTRANSIENT: 'nontransient';
kwCACHE: 'cache';
kwINTERP: 'interp';
kwREPRETRY: 'repretry';
kwREPNOTIFY: 'repnotify';
kwNOTFORCONSOLE: 'notforconsole';
kwARCHETYPE: 'archetype';
kwCROSSLEVELACTIVE: 'crosslevelactive';
kwCROSSLEVELPASSIVE: 'crosslevelpassive';
kwAUTOMATED: 'automated';
kwTRAVEL: 'travel';
kwInput: 'input';
kwCACHEEXEMPT: 'cacheexempt';
kwHIDEDROPDOWN: 'hidedropdown';
kwINSTANCED: 'instanced';
kwDATABINDING: 'databinding';
kwDUPLICATETRANSIENT: 'duplicatetransient';
kwPARSECONFIG: 'parseconfig';
kwEDITINLINENEW: 'editinlinenew';
kwNOTEDITINLINENEW: 'noteditinlinenew';
kwEXPORTSTRUCTS: 'exportstructs';
kwDLLBIND: 'dllbind';
kwDEPRECATED: 'deprecated';
kwSTRICTCONFIG: 'strictconfig';
kwATOMIC: 'atomic';
kwATOMICWHENCOOKED: 'atomicwhencooked';
kwIMMUTABLE: 'immutable';
kwIMMUTABLEWHENCOOKED: 'immutablewhencooked';
kwVIRTUAL: 'virtual';
kwSERVER: 'server';
kwCLIENT: 'client';
kwDLLIMPORT: 'dllimport';
kwDEMORECORDING: 'demorecording';

kwCOLLAPSECATEGORIES: 'collapsecategories';
kwDONTCOLLAPSECATEGORIES: 'dontcollapsecategories';
kwIMPLEMENTS: 'implements';
kwCLASSGROUP: 'classgroup';
kwAUTOEXPANDCATEGORIES: 'autoexpandcategories';
kwAUTOCOLLAPSECATEGORIES: 'autocollapsecategories';
kwDONTAUTOCOLLAPSECATEGORIES: 'dontautocollapsecategories';
kwDONTSORTCATEGORIES: 'dontsortcategories';
kwINHERITS: 'inherits';
kwFORCESCRIPTORDER: 'forcescriptorder';

identifier: ID
	|'default'
	|'self'
	|'super'
	|'global'
	|'class'
	|'interface'
	|'within'
	|'const'
	|'enum'
	|'struct'
	|'var'
	|'local'
	|'replication'
	|'operator'
	|'preoperator'
	|'postoperator'
	|'delegate'
	|'function'
	|'event'
	|'state'
	|'map'
	|'defaultproperties'
	|'structdefaultproperties'
	|'for'
	|'foreach'
	|'return'
	|'break'
	|'continue'
	|'stop'
	|'case'
	|'switch'
	|'until'
	|'do'
	|'while'
	|'else'
	|'if'
	|'ignores'
	|'unreliable'
	|'reliable'
	|'cpptext'
	|'structcpptext'
	|'cppstruct'
	|'array'
	|'byte'
	|'int'
	|'float'
	|'string'
	|'button'
	|'bool'
	|'name'
	|'true'
	|'false'
	|'none'
	|'extends'
	|'expands'
	|'public'
	|'protected'
	|'protectedwrite'
	|'private'
	|'privatewrite'
	|'localized'
	|'out'
	|'optional'
	|'init'
	|'skip'
	|'coerce'
	|'final'
	|'latent'
	|'singular'
	|'static'
	|'exec'
	|'iterator'
	|'simulated'
	|'auto'
	|'noexport'
	|'noexportheader'
	|'editconst'
	|'edfindable'
	|'editinline'
	|'editinlinenotify'
	|'edithide'
	|'editconstarray'
	|'editfixedsize'
	|'editoronly'
	|'editortextbox'
	|'noclear'
	|'noimport'
	|'nontransactional'
	|'serializetext'
	|'config'
	|'globalconfig'
	|'intrinsic'
	|'native'
	|'nativereplication'
	|'nativeonly'
	|'export'
	|'abstract'
	|'perobjectconfig'
	|'perobjectlocalized'
	|'placeable'
	|'nousercreate'
	|'notplaceable'
	|'safereplace'
	|'dependson'
	|'showcategories'
	|'hidecategories'
	|'guid'
	|'long'
	|'transient'
	|'nontransient'
	|'cache'
	|'interp'
	|'repretry'
	|'repnotify'
	|'notforconsole'
	|'archetype'
	|'crosslevelactive'
	|'crosslevelpassive'
	|'automated'
	|'travel'
	|'input'
	|'cacheexempt'
	|'hidedropdown'
	|'instanced'
	|'databinding'
	|'duplicatetransient'
	|'parseconfig'
	|'editinlinenew'
	|'noteditinlinenew'
	|'exportstructs'
	|'dllbind'
	|'deprecated'
	|'strictconfig'
	|'atomic'
	|'atomicwhencooked'
	|'immutable'
	|'immutablewhencooked'
	|'virtual'
	|'server'
	|'client'
	|'dllimport'
	|'demorecording'
	|'collapsecategories'
	|'dontcollapsecategories'
	|'implements'
	|'classgroup'
	|'autoexpandcategories'
	|'autocollapsecategories'
	|'dontautocollapsecategories'
	|'dontsortcategories'
	|'inherits'
	|'forcescriptorder'
	;

ppHASH: '#' .*?;

program:
	classDecl
	(
		ppHASH
		| cpptextBlock
		| constDecl
		| (enumDecl SEMICOLON?)
		| (structDecl)
		| varDecl
		| replicationBlock
		| defaultpropertiesBlock
	)*
	(
		ppHASH
		| functionDecl
		| stateDecl
		| replicationBlock
		| defaultpropertiesBlock
	)*;

typeName: identifier;

className: identifier;

stringLiteral: STRING;
nameLiteral: NAME;
booleanLiteral: kwTRUE | kwFALSE;

noneLiteral: kwNONE;

// Maybe leave the post DOT parsing to the expression parsing?
// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
classLiteral: identifier nameLiteral (DOT (kwSTATIC | kwDEFAULT | kwCONST) DOT)?;

literal: (
		(
			noneLiteral
			| booleanLiteral
			| numeric
			| stringLiteral
			| nameLiteral
		)
		| classLiteral
		| qualifiedIdentifier // e.g. a constant or enum name
	);

numeric: INTEGER | FLOAT;

// Parses the following possiblities.
// Package.Class.Field
// Class.Field
// Class / Field
qualifiedIdentifier: identifier (DOT identifier (DOT identifier)?)?;

classDecl
	:
		(kwCLASS | kwINTERFACE) className
			(
				kwEXTENDS classExtendsReference
				// UC2+
				(kwWITHIN classWithinReference)?
			)?
			classModifier* SEMICOLON
	;

classReference: qualifiedIdentifier;

classExtendsReference: classReference;

classWithinReference: classReference;

classModifier: identifier modifierArguments?;
	// in UC3 a class can have a custom native name.
	// (kwNATIVE modifierArgument?)
	// | kwNATIVEREPLICATION
	// | kwLOCALIZED // UC1
	// | kwABSTRACT
	// | kwPEROBJECTCONFIG
	// | kwTRANSIENT
	// | kwEXPORT
	// | kwNOEXPORT
	// | kwNOUSERCREATE
	// | kwSAFEREPLACE
	// | (kwCONFIG modifierArgument?)
	// // UC2+
	// | kwPLACEABLE
	// | kwNOTPLACEABLE
	// | kwCACHEEXEMPT // UT2004
	// | kwHIDEDROPDOWN
	// | kwEXPORTSTRUCTS
	// | kwINSTANCED
	// | kwPARSECONFIG
	// | kwEDITINLINENEW
	// | kwNOTEDITINLINENEW
	// | (kwDEPENDSON modifierArguments)
	// | (kwCOLLAPSECATEGORIES modifierArguments)
	// | (kwDONTCOLLAPSECATEGORIES modifierArguments?)
	// | (kwSHOWCATEGORIES modifierArguments)
	// | (kwHIDECATEGORIES modifierArguments)
	// | (kwGUID (LPAREN INTEGER COMMA INTEGER COMMA INTEGER COMMA INTEGER RPAREN))
	// // UC3+
	// | kwNATIVEONLY
	// | kwNONTRANSIENT
	// | kwPEROBJECTLOCALIZED
	// | kwDEPRECATED
	// | (kwDLLBIND modifierArgument)
	// | (kwIMPLEMENTS modifierArgument)
	// | (kwCLASSGROUP modifierArguments)
	// | (kwAUTOEXPANDCATEGORIES modifierArguments)
	// | (kwAUTOCOLLAPSECATEGORIES modifierArguments)
	// | (kwDONTAUTOCOLLAPSECATEGORIES modifierArguments)
	// | (kwDONTSORTCATEGORIES modifierArguments)
	// | (kwINHERITS modifierArguments)
	// // true/false only
	// | (kwFORCESCRIPTORDER modifierArgument)
	// ; //ID (LPARENT ID (COMMA ID)* RPARENT)?

// TODO: may be a numeric or typeName!
modifierValue: identifier | numeric;

modifierArgument: LPAREN modifierValue RPAREN;

modifierArguments: LPAREN (modifierValue COMMA?)+ RPAREN;

constDecl: kwCONST constName EQUALS_SIGN constValue SEMICOLON;

constName: identifier;
constValue: literal;

varDecl:
	kwVAR
		(LPAREN (categoryName (COMMA categoryName)*)? RPAREN)?
		variableModifier*
		variableDeclType
		variable nativeType? variableMeta? (COMMA variable)*
	SEMICOLON;

variable: variableName arrayDim?;

// <UIMin=0.0,UIMax=1.0,Toolip="Hello">
variableMeta: LARROW .*? RARROW;

variableName: identifier;
categoryName: identifier;

// UC3 CPP specifier e.g. {public}
nativeSpecifier: LBRACE nativeSpecifier RBRACE;

// UC3 CPP type e.g. {QWORD}
nativeType: LBRACE identifier RBRACE;

variableModifier
	: (
		kwPUBLIC
		| kwPROTECTED
		| kwPROTECTEDWRITE
		| kwPRIVATE
		| kwPRIVATEWRITE
		| kwLOCALIZED
		| kwNATIVE
		| kwCONST
		| kwEDITCONST
		| kwCONFIG
		| kwGLOBALCONFIG
		| kwTRANSIENT
		| kwTRAVEL
		| kwInput
		// UC2
		| kwEXPORT
		| kwNOEXPORT
		| kwCACHE
		| kwAUTOMATED
		| kwEDITINLINE
		| kwEDITINLINENOTIFY
		| kwEDITCONSTARRAY
		| kwEDFINDABLE
		// UC3
		| kwINIT
		| kwEDITFIXEDSIZE
		| kwEDITORONLY
		| kwEDITORTEXTBOX
		| kwNOCLEAR
		| kwNOIMPORT
		| kwSERIALIZETEXT
		| kwNONTRANSACTIONAL
		| kwINSTANCED
		| kwDATABINDING
		| kwDUPLICATETRANSIENT
		| kwREPRETRY
		| kwREPNOTIFY
		| kwINTERP
		| kwDEPRECATED
		| kwNOTFORCONSOLE
		| kwARCHETYPE
		| kwCROSSLEVELACTIVE
		| kwCROSSLEVELPASSIVE
	) nativeSpecifier?
	;

variableType:
	dynArrayType
	| classType
	| mapType
	| primitiveType
	| qualifiedIdentifier
	;

variableDeclType: (enumDecl | structDecl | variableType);

primitiveType:
	kwBYTE
	| kwINT
	| kwFLOAT
	| kwBOOL
	| kwSTRING
	| kwNAME
	| kwButton // alias for a string with an input modifier
	| kwCLASS
	; // This is actually a reference but this is necessary because it's a "reserved" keyword.

// TODO: May reference a constant in class or an external enum/const
arrayDim: LBRACKET (INTEGER | qualifiedIdentifier) RBRACKET;

dynArrayType:
	kwARRAY LARROW (
		structDecl
		| enumDecl
		| classType?
		| mapType?
		| primitiveType
		| qualifiedIdentifier
	) RARROW;

classType: kwCLASS LARROW classReference RARROW;

mapType:
	kwMAP LARROW (
		qualifiedIdentifier
		| (classType | mapType | dynArrayType)
		| primitiveType
	) RARROW;

enumDecl:
	kwENUM enumName
	LBRACE
		(valueName COMMA?)*
	RBRACE
	;

enumName: identifier;

valueName: identifier;

structReference: qualifiedIdentifier;

structDecl:
	kwSTRUCT nativeType? structModifier* structName (
		kwEXTENDS structReference
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

structName: identifier;

structModifier
	:
	(
		// UC2+
		kwNATIVE
		| kwTRANSIENT
		| kwEXPORT
		| kwINIT
		| kwLONG
		// UC3+
		| kwSTRICTCONFIG
		| kwATOMIC
		| kwATOMICWHENCOOKED
		| kwIMMUTABLE
		| kwIMMUTABLEWHENCOOKED
	)
	;

cpptextBlock:
	(kwCPPTEXT | kwSTRUCTCPPTEXT | kwCPPSTRUCT)
	LBRACE
		.*?
	RBRACE;

replicationBlock:
	kwREPLICATION
	LBRACE
		replicationStatement*
	RBRACE;

replicationModifier: (kwRELIABLE | kwUNRELIABLE);

replicationStatement:
	replicationModifier? kwIF (LPAREN condition RPAREN) (
		replicateVariableName (COMMA replicateVariableName)* SEMICOLON
	);

replicateVariableName: identifier;

// public simulated function test(optional int p1, int p2) const; public simulated function
// test(optional int p1, int p2) const { }
functionDecl:
	functionModifier* functionKind
	// We have to identify LPARENT in each, - to prevent a false positive 'operatorName'
	// identification.
	// TODO: are multiple returnModifiers a thing?
	((returnModifier? returnType functionName LPAREN)? | (functionName LPAREN))
		paramDecl*
	RPAREN (kwCONST)? (
		(
			LBRACE
				constDecl* localDecl*
				statement*
			RBRACE
		)
		| SEMICOLON
	);

nativeToken: (LPAREN INTEGER RPAREN);

functionModifier:
	kwPUBLIC
	| kwPROTECTED
	| kwPRIVATE
	| kwSIMULATED
	| (kwNATIVE nativeToken?)
	| kwFINAL
	| kwLATENT
	| kwITERATOR
	| kwSINGULAR
	| kwSTATIC
	| kwEXEC
	// UC3
	| kwCONST
	| kwNOEXPORT
	| kwNOEXPORTHEADER
	| kwVIRTUAL
	| kwRELIABLE
	| kwUNRELIABLE
	| kwSERVER
	| kwCLIENT
	| kwDLLIMPORT
	| kwDEMORECORDING;

functionName: identifier | operatorId;

paramDecl:
	paramModifier* variableType variable (EQUALS_SIGN expression)? COMMA?;

methodReference : identifier;

returnModifier: kwCOERCE;
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
	| kwOPTIONAL
	| kwINIT
	| kwSKIP
	| kwCOERCE
	| kwCONST;

localDecl:
	kwLOCAL variableType variable (COMMA variable)* SEMICOLON;

labelName: identifier;

stateReference: qualifiedIdentifier;

stateDecl: (stateModifier)* kwSTATE (LPAREN RPAREN)? stateName
		(kwEXTENDS stateReference)?
		LBRACE
			(kwIGNORES methodReference (COMMA methodReference)* SEMICOLON)?
			(functionDecl)*
			(labelName COLON statement*)*
		RBRACE SEMICOLON?;

stateName: identifier;

stateModifier: kwAUTO | kwSIMULATED;

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
		| (control SEMICOLON)
		| (expression SEMICOLON)
	) SEMICOLON* // Pass trailing semicolons
	;

control:
	sm_return
	// These will require post-parsing validation
	| sm_break
	| sm_continue
	| sm_stop // in states
	;

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
	| identifier arrayElement? // FIXME: kwCONST in literal context.
	| (LPAREN expression RPAREN);

operatorExpression: DOT | QUESTIONMARK | COLON | identifier | operatorId;

specifier:
	kwSELF
	| kwSTATIC
	| kwCONST
	| kwDEFAULT
	| kwSUPER;

funcSpecifier: (kwGLOBAL | (kwSUPER (LPAREN classReference RPAREN)?)) DOT;

arrayElement: (LBRACKET expression RBRACKET);

cast: classType | identifier;

call: identifier LPAREN (COMMA* expression)* RPAREN;

sm_if: kwIF (LPAREN condition RPAREN) codeBody;

sm_else: kwELSE codeBody;

sm_foreach: kwFOREACH expression codeBody;

sm_for:
	kwFOR (
		LPAREN assignment? SEMICOLON condition? SEMICOLON expression? RPAREN
	) codeBody;

sm_while: kwWHILE (LPAREN condition RPAREN) codeBody;

sm_do_until:
	kwDO codeBody kwUNTIL (LPAREN condition RPAREN);

sm_switch:
	kwSWITCH (LPAREN expression RPAREN)
	LBRACE?
		((kwCASE | kwDEFAULT) literal COLON codeBody)*
	RBRACE?;

sm_return: kwRETURN expression?;
sm_break: kwBREAK;
sm_continue: kwCONTINUE;
sm_stop: kwSTOP;

defaultpropertiesBlock
	:
		kwDEFAULTPROPERTIES
		LBRACE
			defaultProperty*
		RBRACE
	;

defaultProperty: (
		identifier (
			(LPAREN INTEGER RPAREN)
			| (LBRACKET INTEGER RBRACKET)
		)?
	) EQUALS_SIGN (.*? (SEMICOLON)?);

operatorPrecedence: (LPAREN INTEGER RPAREN);

functionKind: (
		kwEVENT
		| kwFUNCTION
		| kwDELEGATE
		| (kwOPERATOR operatorPrecedence)
		| (kwPREOPERATOR)
		| (kwPOSTOPERATOR)
	);