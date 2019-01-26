grammar UCGrammar;

fragment DIGIT: [0-9];
fragment DIGITF: [0-9fF];
fragment EXPONENT: ('e' | 'E') ('+' | '-')? DIGIT+;
fragment HEX_DIGIT: (DIGIT | 'a' ..'f' | 'A' ..'F');
fragment ESC_SEQ:
	'\\' ('b' | 't' | 'n' | 'r' | '"' | '\'' | '\\');

LINE_COMMENT: '//' ~[\r\n]* -> channel(HIDDEN);
BLOCK_COMMENT: '/*' .*? '*/' -> channel(HIDDEN);

DIRECTIVE: '#' ('exec'|'include'|'error'|'call'|'linenumber') .*? ~[\r\n]+ -> skip;
// PP_TICK: '`' ~[\n] -> skip;

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


// NOTE: all class exclusive modifiers are commented out because we don't have to capture them.
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
kwBUTTON: 'button';
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
// kwNATIVEREPLICATION: 'nativereplication';
// kwNATIVEONLY: 'nativeonly';
kwEXPORT: 'export';
// kwABSTRACT: 'abstract';
// kwPEROBJECTCONFIG: 'perobjectconfig';
// kwPEROBJECTLOCALIZED: 'perobjectlocalized';
// kwPLACEABLE: 'placeable';
// kwNOUSERCREATE: 'nousercreate';
// kwNOTPLACEABLE: 'notplaceable';
// kwSAFEREPLACE: 'safereplace';
// kwDEPENDSON: 'dependson';
// kwSHOWCATEGORIES: 'showcategories';
// kwHIDECATEGORIES: 'hidecategories';
// kwGUID: 'guid';
kwLONG: 'long';
kwTRANSIENT: 'transient';
// kwNONTRANSIENT: 'nontransient';
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
// kwCACHEEXEMPT: 'cacheexempt';
// kwHIDEDROPDOWN: 'hidedropdown';
kwINSTANCED: 'instanced';
kwDATABINDING: 'databinding';
kwDUPLICATETRANSIENT: 'duplicatetransient';
kwPARSECONFIG: 'parseconfig';
// kwEDITINLINENEW: 'editinlinenew';
// kwNOTEDITINLINENEW: 'noteditinlinenew';
// kwEXPORTSTRUCTS: 'exportstructs';
// kwDLLBIND: 'dllbind';
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

// kwCOLLAPSECATEGORIES: 'collapsecategories';
// kwDONTCOLLAPSECATEGORIES: 'dontcollapsecategories';
// kwIMPLEMENTS: 'implements';
// kwCLASSGROUP: 'classgroup';
// kwAUTOEXPANDCATEGORIES: 'autoexpandcategories';
// kwAUTOCOLLAPSECATEGORIES: 'autocollapsecategories';
// kwDONTAUTOCOLLAPSECATEGORIES: 'dontautocollapsecategories';
// kwDONTSORTCATEGORIES: 'dontsortcategories';
// kwINHERITS: 'inherits';
// kwFORCESCRIPTORDER: 'forcescriptorder';

kwNEW: 'new';
kwGOTO: 'goto';

kwBEGIN: 'begin';
kwEND: 'end';

identifier
	: ID
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
	// |'nativereplication'
	// |'nativeonly'
	|'export'
	// |'abstract'
	// |'perobjectconfig'
	// |'perobjectlocalized'
	// |'placeable'
	// |'nousercreate'
	// |'notplaceable'
	// |'safereplace'
	// |'dependson'
	// |'showcategories'
	// |'hidecategories'
	// |'guid'
	|'long'
	|'transient'
	// |'nontransient'
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
	// |'cacheexempt'
	// |'hidedropdown'
	|'instanced'
	|'databinding'
	|'duplicatetransient'
	// |'parseconfig'
	// |'editinlinenew'
	// |'noteditinlinenew'
	// |'exportstructs'
	// |'dllbind'
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
	// |'collapsecategories'
	// |'dontcollapsecategories'
	// |'implements'
	// |'classgroup'
	// |'autoexpandcategories'
	// |'autocollapsecategories'
	// |'dontautocollapsecategories'
	// |'dontsortcategories'
	// |'inherits'
	// |'forcescriptorder'
	|'begin'
	|'end'
	|'new'
	|'goto'
	;

// Parses the following possiblities.
// Package.Class.Field
// Class.Field
// Class / Field
qualifiedIdentifier: identifier (DOT identifier)*;

program:
	classDecl
	(
		cpptextBlock
		| constDecl
		| (enumDecl SEMICOLON?)
		| structDecl
		| varDecl
		| replicationBlock
		| defaultpropertiesBlock
	)*
	(
		constDecl
		| functionDecl
		| stateDecl
		| replicationBlock
		| defaultpropertiesBlock
	)*;

literal
	: noneLiteral
	| booleanLiteral
	| numberLiteral
	| stringLiteral
	| nameLiteral
	| classLiteral
	;

numberLiteral: (MINUS | PLUS)? (FLOAT | INTEGER);
stringLiteral: STRING;
nameLiteral: NAME;
booleanLiteral: kwTRUE | kwFALSE;
noneLiteral: kwNONE;

// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
classLiteral: identifier nameLiteral;

classDecl
	:
		(kwCLASS | kwINTERFACE) identifier
			(
				extendsClause
				// UC2+
				withinClause?
			)?
			classModifier* SEMICOLON
	;

extendsClause: kwEXTENDS qualifiedIdentifier;
withinClause: kwWITHIN qualifiedIdentifier;

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

modifierValue
	: qualifiedIdentifier
	| numberLiteral
	;
modifierArgument: OPEN_PARENS modifierValue CLOSE_PARENS;
modifierArguments: OPEN_PARENS (modifierValue COMMA?)+ CLOSE_PARENS;

constDecl: kwCONST identifier ASSIGNMENT constValue SEMICOLON;
constValue: literal | qualifiedIdentifier;

enumDecl:
	kwENUM identifier
	OPEN_BRACE
		enumMember*
	CLOSE_BRACE
	;

enumMember: (identifier COMMA?);

structDecl
	:	kwSTRUCT nativeTypeDecl? structModifier* identifier extendsClause?
		OPEN_BRACE
		(
			constDecl
			| (enumDecl SEMICOLON?)
			| structDecl
			| varDecl
			// Unfortunately these can appear in any order.
			| cpptextBlock
			| defaultpropertiesBlock
		)*
		CLOSE_BRACE SEMICOLON?
	;

structModifier
	// UC2+
	: kwNATIVE
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
	;

arrayDim
	: OPEN_BRACKET (INTEGER | qualifiedIdentifier) CLOSE_BRACKET
	;

// var (GROUP)
// MODIFIER TYPE
// VARIABLE, VARIABLE...;
varDecl: kwVAR (OPEN_PARENS categoryList? CLOSE_PARENS)?
	variableModifier* inlinedDeclTypes
	variable (COMMA variable)* SEMICOLON;

// id[5] {DWORD} <Order=1>
variable:
	identifier
	arrayDim?
	// FIXME: matches invalid code
	// nativeTypeDecl?
	variableMeta?
	;

// UC3 <UIMin=0.0|UIMax=1.0|Toolip=Hello world!>
variableMeta: LT metaList GT;

metaProperty: identifier ASSIGNMENT metaValue;
// FIXME: This is incorrect, any value is allowed.
metaValue: literal;
metaList: metaProperty (BITWISE_OR metaProperty)*;

categoryList: identifier (COMMA identifier)*;

// UC3 CPP specifier e.g. {public}
nativeModifierDecl: OPEN_BRACE identifier CLOSE_BRACE;

// UC3 CPP type e.g. {QWORD}
nativeTypeDecl: OPEN_BRACE .*? CLOSE_BRACE;

// UC3 CPP map e.g. map{FName, FLOAT}
nativeMapTypeDecl: OPEN_BRACE .*? COMMA .*? CLOSE_BRACE;

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
		| kwEDITHIDE
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
	) nativeModifierDecl?
	;

typeDecl
	: arrayType
	| classType
	| delegateType
	| mapType
	| type
	;

inlinedDeclTypes
	: enumDecl
	| structDecl
	| typeDecl
	;

predefinedType
	: kwBYTE
	| kwINT
	| kwFLOAT
	| kwBOOL
	| kwSTRING
	| kwNAME
	| kwBUTTON // alias for a string with an input modifier
	| kwCLASS
	| kwDELEGATE
	; // This is actually a reference but this is necessary because it's a "reserved" keyword.

type
	: predefinedType
	| qualifiedIdentifier
	;

// Note: inlinedDeclTypes includes another arrayGeneric!
arrayType: kwARRAY LT inlinedDeclTypes GT;
classType: kwCLASS LT type GT;
delegateType: kwDELEGATE LT identifier GT;
mapType: kwMAP nativeMapTypeDecl;

cpptextBlock:
	(kwCPPTEXT | kwSTRUCTCPPTEXT | kwCPPSTRUCT)
	OPEN_BRACE
		.*?
	CLOSE_BRACE;

replicationBlock:
	kwREPLICATION
	OPEN_BRACE
		replicationStatement*
	CLOSE_BRACE;

replicationModifier: (kwRELIABLE | kwUNRELIABLE);

replicationStatement:
	replicationModifier? kwIF (OPEN_PARENS expression CLOSE_PARENS) (
		replicateId (COMMA replicateId)* SEMICOLON
	);

replicateId: identifier;

/* Parses:
 * public simulated function coerce class<Actor> test(optional int p1, int p2) const;
 */
functionDecl:
	functionModifier* functionKind
	// Found in UT2004/GameProfile.uc, any function modifier can be written post functionKind, this is applied to the function during compilation.
	functionModifier*
	// We have to identify LPARENT in each, - to prevent a false positive 'operatorName'
	((returnTypeModifier? returnType functionName OPEN_PARENS)? | functionName OPEN_PARENS) parameters? CLOSE_PARENS kwCONST? (SEMICOLON | (
		functionBody
		SEMICOLON?
	));

/* Parses:
 * { local Actor test, test2; return test.Class; }
 */
functionBody:
	OPEN_BRACE
		(constDecl | localDecl)*
		statement*
	CLOSE_BRACE;

nativeToken: (OPEN_PARENS INTEGER CLOSE_PARENS);

functionModifier
	: kwPUBLIC
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
	| kwDEMORECORDING
	;

functionName: identifier | operatorId;

parameters: paramDecl (COMMA paramDecl)*;

paramDecl:
	paramModifier* typeDecl variable (ASSIGNMENT expression)?;

// TODO: are multiple returnModifiers a thing?
returnTypeModifier
	: kwCOERCE // UC3+
	;

returnType: typeDecl;

operatorId
	:
	(
		DOLLAR
		| AT
		| SHARP
		| ASSIGNMENT
		| BANG
		| AMP
		| BITWISE_OR
		| CARET
		| STAR
		| MINUS
		| PLUS
		| DIV
		| PERCENT
		| TILDE
		| LT
		| GT
	)
	(
		ASSIGNMENT
		| AMP
		| BITWISE_OR
		| CARET
		| STAR
		| MINUS
		| PLUS
		| DIV
		| LT
		| GT
	)?
	GT?
	;

paramModifier
	: kwOUT
	| kwOPTIONAL
	| kwINIT
	| kwSKIP
	| kwCOERCE
	| kwCONST
	;

localDecl:
	kwLOCAL typeDecl variable (COMMA variable)* SEMICOLON;

labelName: identifier;

ignoresList: identifier (COMMA identifier)*;

stateDecl: (stateModifier)* kwSTATE (OPEN_PARENS CLOSE_PARENS)? identifier
		extendsClause?
		OPEN_BRACE
			(kwIGNORES ignoresList SEMICOLON)?
			localDecl*
			functionDecl*
			(labeledStatement statement*)*
		CLOSE_BRACE SEMICOLON?;

stateModifier: kwAUTO | kwSIMULATED;

codeBlock: (OPEN_BRACE statement* CLOSE_BRACE);
codeBlockOptional: (codeBlock | statement*);

statement:
	(
		ifStatement
		| forStatement
		| foreachStatement
		| whileStatement
		| doStatement
		| switchStatement
		| controlStatement
		| labeledStatement
		| (expression SEMICOLON)
	) SEMICOLON* // Pass trailing semicolons
	;

labeledStatement: labelName COLON;
gotoStatement: kwGOTO labelName SEMICOLON;

controlStatement
	: returnStatement
	| gotoStatement
	// These will require post-parsing validation
	| breakStatement
	| continueStatement
	| stopStatement // in states
	;

// should be EXPR = EXPR but UnrealScript is an exception in that it does - only allow assignments
// as primary statements. Rule: a.b.c.d = 4+5 Invalid: "00" = "1", "00".Length = 1 FIXME: Only
// supports ID = expression
assignment: expression ASSIGNMENT expression;

expression
	: expression INTERR expression COLON expression
	| expression functionName expression
	| unaryExpression
	;

unaryExpression
	: primaryExpression functionName primaryExpression // HACK: FIXME shouldn't be neccessary but since UC supports id for pre and post operators we kinda have to!
	| unaryExpression functionName // (id ++) etc
	| functionName unaryExpression // (++ id)
	| primaryExpression
	;

primaryExpression
	: (kwSUPER | kwGLOBAL) DOT identifier OPEN_PARENS arguments CLOSE_PARENS
	| (kwSUPER | kwGLOBAL) OPEN_PARENS identifier CLOSE_PARENS DOT identifier arguments
	| kwNEW (OPEN_PARENS arguments CLOSE_PARENS)? expression (OPEN_PARENS expression CLOSE_PARENS)?
	| literal
	| kwDEFAULT | kwSELF
	| identifier
	| (OPEN_PARENS expression CLOSE_PARENS)
	| primaryExpression DOT contextSpecifiers
	| primaryExpression DOT identifier
	| predefinedProps DOT primaryExpression
	| primaryExpression OPEN_PARENS arguments CLOSE_PARENS
	| primaryExpression OPEN_BRACKET expression CLOSE_BRACKET
	// nameof, arraycount?
	;

predefinedProps
	: kwSTATIC
	| kwDEFAULT
	| kwSELF
	;

contextSpecifiers
	: kwDEFAULT
	| kwSTATIC
	| kwCONST
	;

arguments: (COMMA* argument)*;
argument: expression;

ifStatement:
	kwIF (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	(kwELSE codeBlockOptional)?;

elseStatement: kwELSE codeBlockOptional;
foreachStatement: kwFOREACH primaryExpression codeBlockOptional;

forStatement:
	kwFOR (
		OPEN_PARENS assignment? SEMICOLON expression? SEMICOLON expression? CLOSE_PARENS
	) codeBlockOptional;

whileStatement
	: kwWHILE (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	;

doStatement
	: kwDO
		codeBlockOptional
	  kwUNTIL (OPEN_PARENS expression CLOSE_PARENS)
	;

switchStatement:
	kwSWITCH (OPEN_PARENS expression CLOSE_PARENS)
	OPEN_BRACE? (
		(kwCASE | kwDEFAULT) expression COLON
			codeBlockOptional
	)*
	CLOSE_BRACE?;

returnStatement: kwRETURN expression? SEMICOLON;
breakStatement: kwBREAK SEMICOLON;
continueStatement: kwCONTINUE SEMICOLON;
stopStatement: kwSTOP SEMICOLON;

defaultpropertiesBlock
	:
		kwDEFAULTPROPERTIES
		OPEN_BRACE
			propertiesBlock
		CLOSE_BRACE
	;

objectDecl
	:
		kwBEGIN ID
			(
				kwNAME ASSIGNMENT objectId | kwCLASS ASSIGNMENT objectClass
			)+
			propertiesBlock
		kwEND ID
	;

propertiesBlock: (objectDecl | defaultVariable)*;

objectId: identifier;
objectClass: qualifiedIdentifier;

defaultVariable:
	defaultId ((OPEN_PARENS INTEGER CLOSE_PARENS) | (OPEN_BRACKET INTEGER CLOSE_BRACKET))?
	(
		ASSIGNMENT defaultValue
		// Call parentheses are optional
		| DOT identifier (OPEN_PARENS defaultValue CLOSE_PARENS)?
	) SEMICOLON?
	;

defaultId: identifier;

// (variableList)
structLiteral
	: OPEN_PARENS variablesList? CLOSE_PARENS
	;

// id=literal,* or literal,*
variablesList
	: (defaultLiteral (COMMA defaultLiteral)*)
	| (defaultVariable (COMMA defaultVariable)*)
	;

defaultLiteral
	: structLiteral
	| noneLiteral
	| booleanLiteral
	| numberLiteral
	| stringLiteral
	| classLiteral
	| qualifiedIdentifier
	;

defaultValue
	: defaultLiteral
	| identifier
	;

operatorPrecedence: (OPEN_PARENS INTEGER CLOSE_PARENS);

functionKind
	: kwEVENT
	| kwFUNCTION
	| kwDELEGATE
	| kwOPERATOR operatorPrecedence
	| kwPREOPERATOR
	| kwPOSTOPERATOR
	;