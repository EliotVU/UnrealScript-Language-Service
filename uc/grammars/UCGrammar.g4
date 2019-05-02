grammar UCGrammar;

import UCLexer;

// NOTE: all class exclusive modifiers are commented out because we don't have to capture them.
kwDEFAULT: 'default';
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
kwEDITINLINEUSE: 'editinlineuse';
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
kwALLOWABSTRACT: 'allowabstract';
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
kwCLASSREDIRECT: 'classredirect';
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

kwGOTO: 'goto';

kwBEGIN: 'begin';
kwOBJECT: 'object';
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
	|'editinlineuse'
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
	|'allowabstract'
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
	|'object'
	|'end'
	|'new'
	|'goto'
	|'vect'
	|'rot'
	|'rng'
	;

// Parses the following possiblities.
// Package.Class.Field
// Class.Field
// Class / Field
qualifiedIdentifier: identifier (DOT identifier)*;

program:
	defaultpropertiesBlock | classDecl

	(
		constDecl
		| (enumDecl SEMICOLON?)
		| structDecl
		| varDecl
		| replicationBlock
		| defaultpropertiesBlock
		| cppText
	)*

	(
		constDecl
		| functionDecl
		| stateDecl
		| replicationBlock
		| defaultpropertiesBlock
	)*

	EOF
;

literal
	: noneLiteral
	| booleanLiteral
	| numberLiteral
	| stringLiteral
	| classLiteral
	| nameLiteral
	;

numberLiteral: (MINUS | PLUS)? (FLOAT | INTEGER);
stringLiteral: STRING;
nameLiteral: NAME;
booleanLiteral: kwTRUE | kwFALSE;
objectLiteral: NAME;
noneLiteral: kwNONE;

// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
classLiteral: identifier objectLiteral;

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
	// | (kwCLASSREDIRECT modifierArguments)
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

enumMember: identifier metaTuple? COMMA?;

structDecl
	:	kwSTRUCT // (OPEN_BRACE .*? CLOSE_BRACE)? // parses native type like "struct {DOUBLE}"
			structModifier* identifier extendsClause?
		OPEN_BRACE
		(
			constDecl
			| (enumDecl SEMICOLON?)
			| structDecl
			| varDecl
			// Unfortunately these can appear in any order.
			| structCppText | cppText
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
	/* cppcode? */ // nativeTypeDecl
	/* metaTuple? */
	;

// UC3 <UIMin=0.0|UIMax=1.0|Toolip=Hello world!>
// FIXME: This is incorrect, any value is allowed.
metaTuple: LT (metaAssignment BITWISE_OR?)* GT;
metaAssignment: identifier ASSIGNMENT .*?;

categoryList: identifier (COMMA identifier)*;

// UC3 CPP specifier e.g. {public}
nativeTypeModifier: OPEN_BRACE identifier CLOSE_BRACE;

// UC3 CPP map e.g. map{FName, FLOAT}
nativeMapType: OPEN_BRACE .*? COMMA .*? CLOSE_BRACE; // use cppcode?

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
		| kwEDITINLINEUSE
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
		| kwALLOWABSTRACT
	) nativeTypeModifier?
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
mapType: kwMAP /* nativeMapType */;

cppText
	: kwCPPTEXT
	  // UnrealScriptBug: Must on next the line after keyword!
	  cppcode
	;

structCppText
	: kwSTRUCTCPPTEXT
	  // UnrealScriptBug: Must on next the line after keyword!
	  cppcode
	;

cppcode: (OPEN_BRACE .*? CLOSE_BRACE)+; // UnrealScriptBug: Anything WHATSOEVER can be written after this closing brace as long as it's on the same line!

replicationBlock:
	kwREPLICATION
	OPEN_BRACE
		replicationStatement*
	CLOSE_BRACE;

replicationModifier: (kwRELIABLE | kwUNRELIABLE);

replicationStatement:
	replicationModifier? kwIF (OPEN_PARENS expression CLOSE_PARENS) (
		identifier (COMMA identifier)* SEMICOLON
	);

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

functionName: identifier | operator;

parameters: paramDecl (COMMA paramDecl)*;

paramDecl:
	paramModifier* typeDecl variable (ASSIGNMENT expression)?;

// TODO: are multiple returnModifiers a thing?
returnTypeModifier
	: kwCOERCE // UC3+
	;

returnType: typeDecl;

operator
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
	kwLOCAL typeDecl variable (COMMA variable)*
	// UnrealScriptBug: Can have multiple semicolons which is inconsistent with all other declaration kinds.
	SEMICOLON+;

ignoresList: identifier (COMMA identifier)*;

stateDecl: stateModifier* kwSTATE (OPEN_PARENS CLOSE_PARENS)? identifier
		extendsClause?
		OPEN_BRACE
			(kwIGNORES ignoresList SEMICOLON)?
			localDecl*
			functionDecl*
			(labeledStatement statement*)*
		CLOSE_BRACE SEMICOLON?;

stateModifier: kwAUTO | kwSIMULATED;

codeBlockOptional: (OPEN_BRACE statement* CLOSE_BRACE) | statement?;

statement
	: SEMICOLON

	| ifStatement
	| forStatement
	| foreachStatement
	| whileStatement
	| doStatement
	| switchStatement

	| returnStatement SEMICOLON
	| gotoStatement SEMICOLON

	// These will require post-parsing validation
	| breakStatement SEMICOLON // in for loops only
	| continueStatement SEMICOLON // in for loops only
	| stopStatement SEMICOLON // in states only

	| labeledStatement

	// We must check for expressions after ALL statements so that we don't end up capturing statement keywords as identifiers.
	| (assignmentExpression SEMICOLON)
	| (expression SEMICOLON) // TODO: Maybe replace with unaryExpression?
	;

labeledStatement: identifier COLON;
gotoStatement: kwGOTO identifier SEMICOLON;

assignmentOperator: /* '+=' | '-=' | '/=' | '*=' | '|=' | '&=' | '$=' | '@=' | */ ASSIGNMENT;
assignmentExpression: primaryExpression assignmentOperator expression;

expression
	: expression functionName expression #binaryOperator
	| unaryExpression #unaryOperator
	;

unaryExpression
	: primaryExpression #primaryOperator
	| unaryExpression INTERR expression COLON expression #ternaryOperator
	| primaryExpression operator #postOperator
	| operator primaryExpression #preOperator
	;

// FIXME: might be more restricted, but at least "default.class" is valid code.
classArgument: primaryExpression; // Inclusive template argument (will be parsed as a function call)

primaryExpression
	: literal 																						#literalExpression
	| kwCLASS (LT identifier GT) (OPEN_PARENS expression CLOSE_PARENS)						#genericClassCasting
	| (kwDEFAULT | 'self' | 'super' | 'global' | kwSTATIC) 											#specifierExpression
	| 'new' (OPEN_PARENS arguments CLOSE_PARENS)? classArgument 									#newExpression
	| 'vect' (OPEN_PARENS numberLiteral COMMA numberLiteral COMMA numberLiteral CLOSE_PARENS) 		#vectLiteral
	| 'rot' (OPEN_PARENS numberLiteral COMMA numberLiteral COMMA numberLiteral CLOSE_PARENS) 		#rotLiteral
	| 'rng' (OPEN_PARENS numberLiteral COMMA numberLiteral CLOSE_PARENS) 							#rngLiteral
	// Note any kwTOKEN must preceed identifier!
	| identifier 																					#memberExpression
	| (OPEN_PARENS expression CLOSE_PARENS) 														#parenthesisExpression
	| primaryExpression DOT (classLiteralSpecifier | identifier)									#contextExpression
	| primaryExpression (OPEN_PARENS arguments CLOSE_PARENS) 										#argumentedExpression
	| primaryExpression (OPEN_BRACKET expression CLOSE_BRACKET) 									#indexExpression
	// nameof, arraycount?
	;

classLiteralSpecifier
	: kwDEFAULT
	| kwSTATIC
	| kwCONST
	;

arguments: (COMMA* expression)*;

ifStatement:
	kwIF (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	elseStatement?;

elseStatement: kwELSE codeBlockOptional;
foreachStatement: kwFOREACH primaryExpression codeBlockOptional;

forStatement:
	kwFOR (OPEN_PARENS expression? SEMICOLON expression? SEMICOLON expression? CLOSE_PARENS)
		codeBlockOptional;

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
	// Switch braces are NOT optional
	OPEN_BRACE
		switchCase*
	CLOSE_BRACE;

switchCase:
	((kwCASE expression?) | kwDEFAULT) COLON
		statement*
		breakStatement?
	;

returnStatement: kwRETURN expression?;
breakStatement: kwBREAK;
continueStatement: kwCONTINUE;
stopStatement: kwSTOP;

defaultpropertiesBlock
	:
		kwDEFAULTPROPERTIES
		// UnrealScriptBug: Must on next the line after keyword!
		OPEN_BRACE
			(objectDecl | defaultVariable)*
		CLOSE_BRACE
	;

objectDecl
	:
		// UnrealScriptBug: name= and class= are required to be on the same line as the keyword!
		kwBEGIN kwOBJECT
			(objectDecl | defaultVariable)*
		kwEND kwOBJECT
	;

// FIXME: Use expressions pattern instead?
defaultVariable:
	defaultId
	((OPEN_PARENS INTEGER CLOSE_PARENS) | (OPEN_BRACKET INTEGER CLOSE_BRACKET))?
	(
		ASSIGNMENT defaultValue
		// Call parentheses are optional
		| DOT identifier (OPEN_PARENS defaultValue CLOSE_PARENS)?
	) SEMICOLON?
	;

defaultId: qualifiedIdentifier;

// (variableList)
structLiteral
	: OPEN_PARENS defaultArguments? CLOSE_PARENS
	;

// id=literal,* or literal,*
defaultArguments
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