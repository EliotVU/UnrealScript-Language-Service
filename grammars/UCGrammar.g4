grammar UCGrammar;

import UCLexer;

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
kwDEFAULTPROPERTIES: 'defaultproperties';
kwSTRUCTDEFAULTPROPERTIES: 'structdefaultproperties';
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
kwNATIVE: 'native';
kwINTRINSIC: 'intrinsic';
kwEXPORT: 'export';
kwLONG: 'long';
kwTRANSIENT: 'transient';
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
kwINSTANCED: 'instanced';
kwDATABINDING: 'databinding';
kwDUPLICATETRANSIENT: 'duplicatetransient';
kwPARSECONFIG: 'parseconfig';
kwCLASSREDIRECT: 'classredirect';
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

kwGOTO: 'goto';
kwASSERT: 'assert';

kwBEGIN: 'begin';
kwOBJECT: 'object';
kwEND: 'end';

// Class modifier keywords have been commented out, because we are not using them for parsing.
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
	|'cppstruct'
	|'structcpptext'
	|'array'
	|'byte'
	|'int'
	|'float'
	|'string'
	|'pointer'
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
	|'assert'
	|'vect'
	|'rot'
	|'rng'
	;

// Parses the following possiblities.
// Package.Class
// Class.Field
// Class / Field
qualifiedIdentifier: identifier (DOT identifier)?;

// FIXME: Consumes atleast one token after "#error"
directive
	: SHARP identifier
	{((): boolean => {
			if (!this.currentToken) {
				return true;
			}

			const initialLine = this.currentToken.line;
			while (this.currentToken.line === initialLine) {
				if (this.matchedEOF) {
					break;
				}

				this.consume();
				// FIXME!
				if (!this.currentToken || this.currentToken.text === '<EOF>') {
					break;
				}
			}
			return true;
	})()}?
	;

program: member* EOF;

member
	: classDecl
	| constDecl
	| (enumDecl SEMICOLON)
	| (structDecl SEMICOLON)
	| varDecl
	| cppText
	| replicationBlock
	| functionDecl
	| stateDecl
	| defaultPropertiesBlock
	| directive
	| SEMICOLON
	;

literal
	: noneLiteral
	| boolLiteral
	| floatLiteral
	| intLiteral
	| stringLiteral
	| objectLiteral
	| nameLiteral
	| vectToken
	| rotToken
	| rngToken
	| nameOfToken
	;

floatLiteral: (MINUS | PLUS)? (FLOAT);
intLiteral: (MINUS | PLUS)? (INTEGER);

numberLiteral: (MINUS | PLUS)? (FLOAT | INTEGER);
stringLiteral: STRING;
nameLiteral: NAME;
boolLiteral
	: 'true'
	| 'false'
	;
noneLiteral: 'none';

// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
objectLiteral: identifier NAME;

classDecl
	: ('class' | 'interface') identifier (extendsClause withinClause?)?
		classModifier*
		SEMICOLON
	;

extendsClause: ('extends' | 'expands') qualifiedIdentifier;
withinClause: 'within' qualifiedIdentifier;

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
	: identifier
	| numberLiteral
	;
modifierArgument: OPEN_PARENS modifierValue CLOSE_PARENS;
modifierArguments: OPEN_PARENS (modifierValue COMMA?)+ CLOSE_PARENS;

constDecl: 'const' identifier ASSIGNMENT constValue SEMICOLON;
constValue
	: noneLiteral
	| boolLiteral
	| intLiteral
	| floatLiteral
	| stringLiteral
	| objectLiteral
	| nameLiteral
	| vectToken
	| rotToken
	| rngToken
	| arrayCountToken
	| nameOfToken
	| sizeOfToken
	;

vectToken
	: 'vect' (OPEN_PARENS numberLiteral COMMA numberLiteral COMMA numberLiteral CLOSE_PARENS)
	;

rotToken
	: 'rot' (OPEN_PARENS numberLiteral COMMA numberLiteral COMMA numberLiteral CLOSE_PARENS)
	;

rngToken
	: 'rng' (OPEN_PARENS numberLiteral COMMA numberLiteral CLOSE_PARENS)
	;

arrayCountToken
	: 'arraycount' (OPEN_PARENS identifier CLOSE_PARENS)
	;

nameOfToken
	: 'nameof' (OPEN_PARENS identifier CLOSE_PARENS)
	;

sizeOfToken
	: 'sizeof' (OPEN_PARENS identifier CLOSE_PARENS)
	;

enumDecl:
	'enum' identifier metaData?
	OPEN_BRACE
		enumMember*
	CLOSE_BRACE
	;

enumMember: identifier metaData? COMMA?;

structDecl
	:	'struct' exportBlockText? structModifier* identifier extendsClause?
		OPEN_BRACE
			structMember*
		CLOSE_BRACE
	;

structMember
	: constDecl
	| (enumDecl SEMICOLON)
	| (structDecl SEMICOLON)
	| varDecl
	| structCppText
	| structDefaultPropertiesBlock
	| directive
	| SEMICOLON
	;

structModifier
	// UC2+
	: 'native'
	| 'transient'
	| 'export'
	| 'init'
	| 'long'
	// UC3+
	| 'strictconfig'
	| 'atomic'
	| 'atomicwhencooked'
	| 'immutable'
	| 'immutablewhencooked'
	;

arrayDim
	: INTEGER
	| qualifiedIdentifier // Referres a constant in class scope, or an enum's member.
	;

// var (GROUP)
// MODIFIER TYPE
// VARIABLE, VARIABLE...;
varDecl: 'var' (OPEN_PARENS categoryList? CLOSE_PARENS)?
	variableModifier* inlinedDeclTypes
	variable (COMMA variable)* SEMICOLON;

// id[5] {DWORD} <Order=1>
variable: identifier (OPEN_BRACKET arrayDim? CLOSE_BRACKET)?
	exportBlockText?
	metaData?
	;

// UC3 <UIMin=0.0|UIMax=1.0|Toolip=Hello world!>
metaData: LT metaTag* GT;
metaTag: identifier ASSIGNMENT (~(BITWISE_OR | GT) | metaTag);

categoryList: identifier (COMMA identifier)*;

variableModifier
	: ('public' exportBlockText?)
	| ('protected' exportBlockText?)
	| ('protectedwrite' exportBlockText?)
	| ('private' exportBlockText?)
	| ('privatewrite' exportBlockText?)
	| 'localized'
	| 'native'
	| 'const'
	| 'editconst'
	| 'config'
	| 'globalconfig'
	| 'transient'
	| 'travel'
	| 'input'
	// UC2
	| 'export'
	| 'noexport'
	| 'noimport'
	| 'cache'
	| 'automated'
	| 'editinline'
	| 'editinlinenotify'
	| 'editinlineuse'
	| 'editconstarray'
	| 'edfindable'
	// UC3
	| 'init'
	| 'edithide'
	| 'editfixedsize'
	| 'editoronly'
	| 'editortextbox'
	| 'noclear'
	| 'serializetext'
	| 'nontransactional'
	| 'instanced'
	| 'databinding'
	| 'duplicatetransient'
	| 'repretry'
	| 'repnotify'
	| 'interp'
	| 'deprecated'
	| 'notforconsole'
	| 'archetype'
	| 'crosslevelactive'
	| 'crosslevelpassive'
	| 'allowabstract'
	;

typeDecl
	: predefinedType
	| classType
	| arrayType
	| delegateType
	| mapType
	| qualifiedIdentifier
	;

inlinedDeclTypes
	: enumDecl
	| structDecl
	| typeDecl
	;

predefinedType
	: 'byte'
	| 'int'
	| 'float'
	| 'bool'
	| 'pointer'
	| 'string'
	| 'name'
	| 'button' // alias for a string with an input modifier
	;

// Note: inlinedDeclTypes includes another arrayGeneric!
arrayType: 'array' (LT inlinedDeclTypes GT);
classType: 'class' (LT identifier GT)?;
delegateType: 'delegate' (LT qualifiedIdentifier GT); // TODO: qualifiedIdentifier is hardcoded to 2 identifiers MAX.
mapType: 'map' exportBlockText;

cppText
	: 'cpptext' exportBlockText
	;

structCppText
	: ('structcpptext' | 'cppstruct') exportBlockText
	;

// UnrealScriptBug: Anything WHATSOEVER can be written after this closing brace as long as it's on the same line!
exportBlockText
	: OPEN_BRACE (~CLOSE_BRACE | exportBlockText)* CLOSE_BRACE
	;

replicationBlock
	: 'replication'
		OPEN_BRACE
			replicationStatement*
		CLOSE_BRACE
	;

replicationModifier
	: 'reliable'
	| 'unreliable'
	;

replicationStatement
	: replicationModifier? 'if' (OPEN_PARENS expression CLOSE_PARENS)
		identifier (COMMA identifier)* SEMICOLON
	;

/* Parses:
 * public simulated function coerce class<Actor> test(optional int p1, int p2) const;
 */
functionDecl:
	functionModifier* functionKind
	// Found in UT2004/GameProfile.uc, any function modifier can be written post functionKind, this is applied to the function during compilation.
	functionModifier*
	// We have to identify LPARENT in each, - to prevent a false positive 'operatorName'
	((returnTypeModifier? returnType functionName OPEN_PARENS)? | functionName OPEN_PARENS) parameters? CLOSE_PARENS 'const'?
	(SEMICOLON | (
		OPEN_BRACE
			functionMember*
			statement*
		CLOSE_BRACE
	));

/* Parses:
 * { local Actor test, test2; return test.Class; }
 */
functionMember
	: constDecl
	| localDecl
	| directive
	| SEMICOLON
	;

nativeToken: (OPEN_PARENS INTEGER CLOSE_PARENS);

functionModifier
	: ('public' exportBlockText?)
	| ('protected' exportBlockText?)
	| ('private' exportBlockText?)
	| 'final'
	| 'simulated'
	| 'static'
	| 'native' nativeToken?
	| 'latent'
	| 'singular'
	| 'iterator'
	| 'exec'
	// UC3
	| 'const'
	| 'noexport'
	| 'noexportheader'
	| 'virtual'
	| 'reliable'
	| 'unreliable'
	| 'server'
	| 'client'
	| 'dllimport'
	| 'demorecording'
	| 'k2call'
	| 'k2pure'
	| 'k2override'
	;

// TODO: implement a more restricted operator rule.
functionName: identifier | operator;

parameters: paramDecl (COMMA paramDecl)*;

paramDecl: paramModifier* typeDecl variable (ASSIGNMENT expression)?;

returnTypeModifier
	: 'coerce' // UC3+
	;

returnType: typeDecl;

paramModifier
	: 'out'
	| 'optional'
	| 'init'
	| 'skip'
	| 'coerce'
	| 'const'
	;

localDecl
	: 'local' typeDecl variable (COMMA variable)* SEMICOLON
	;

stateDecl
	: stateModifier* 'state' (OPEN_PARENS CLOSE_PARENS)? identifier
		extendsClause?
		OPEN_BRACE
			stateMember*
			statement*
		CLOSE_BRACE
	;

stateModifier
	: 'auto'
	| 'simulated'
	;

stateMember
	: constDecl
	| localDecl
	| ignoresDecl
	| functionDecl
	| directive
	| SEMICOLON
	;

ignoresDecl
	: 'ignores' (identifier (COMMA identifier)*) SEMICOLON
	;

codeBlockOptional
	: (OPEN_BRACE statement* CLOSE_BRACE)
	| statement
	;

statement
	: SEMICOLON

	| ifStatement
	| forStatement
	| foreachStatement
	| whileStatement
	| doStatement
	| switchStatement

	| assertStatement SEMICOLON
	| returnStatement SEMICOLON
	| gotoStatement SEMICOLON

	// These will require post-parsing validation
	| breakStatement SEMICOLON // in for loops only
	| continueStatement SEMICOLON // in for loops only
	| stopStatement SEMICOLON // in states only

	| labeledStatement

	// We must check for expressions after ALL statements so that we don't end up capturing statement keywords as identifiers.
	| expressionStatement SEMICOLON
	| constDecl
	| directive
	;

expressionStatement: expression;

ifStatement
	: 'if' (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	  elseStatement?
	;

elseStatement: 'else' codeBlockOptional;
foreachStatement: 'foreach' primaryExpression codeBlockOptional;

forStatement
	: 'for' (OPEN_PARENS expression? SEMICOLON expression? SEMICOLON expression? CLOSE_PARENS)
		codeBlockOptional
	;

whileStatement
	: 'while' (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	;

doStatement
	: 'do'
		codeBlockOptional
	  'until' (OPEN_PARENS expression CLOSE_PARENS)
	;

switchStatement
	: 'switch' (OPEN_PARENS expression CLOSE_PARENS)
		// Note: Switch braces are NOT optional
		OPEN_BRACE
			caseClause*
			defaultClause?
		CLOSE_BRACE
	;

caseClause
	: 'case' expression? COLON
		statement*
	;

defaultClause
	: 'default' COLON
		statement*
	;

returnStatement: 'return' expression?;
breakStatement: 'break';
continueStatement: 'continue';
stopStatement: 'stop';
labeledStatement: identifier COLON;
gotoStatement: 'goto' expression;
assertStatement: 'assert' (OPEN_PARENS expression CLOSE_PARENS);

assignmentOperator
	: ASSIGNMENT
	| ASSIGNMENT_INCR
	| ASSIGNMENT_DECR
	| ASSIGNMENT_AT
	| ASSIGNMENT_DOLLAR
	| ASSIGNMENT_AND
	| ASSIGNMENT_OR
	| ASSIGNMENT_STAR
	| ASSIGNMENT_CARET
	| ASSIGNMENT_DIV
	;

unaryOperator
	: SHARP
	| BANG
	| AMP
	| MINUS
	| PLUS
	| PERCENT
	| TILDE
	| SHARP
	| DOLLAR
	| AT
	| DECR
	| INCR
	;

operator
	: DOLLAR
	| AT
	| SHARP
	| BANG
	| AMP
	| BITWISE_OR
	| CARET
	| STAR
	| MINUS
	| PLUS
	| DIV
	| PERCENT
	| INCR
	| DECR
	| TILDE
	| EXP
	| LSHIFT
	| SHIFT
	| LT
	// FIXME:??? We don't want to capture << and >> so that our parser cannot fail at trailing arrows array<class<Object>>
	| (GT GT | GT)
	| GT
	| OR
	| AND
	| EQ
	| NEQ
	| GEQ
	| LEQ
	| IEQ
	| MEQ
	| ASSIGNMENT_INCR
	| ASSIGNMENT_DECR
	| ASSIGNMENT_AT
	| ASSIGNMENT_DOLLAR
	| ASSIGNMENT_AND
	| ASSIGNMENT_OR
	| ASSIGNMENT_STAR
	| ASSIGNMENT_CARET
	| ASSIGNMENT_DIV
	;

expression
	: assignmentExpression
	| unaryExpression
	| binaryExpression
	| conditionalExpression
	;

assignmentExpression
	: primaryExpression assignmentOperator expression
	;

unaryExpression
	: primaryExpression
	| primaryExpression unaryOperator
	| unaryOperator primaryExpression
	;

binaryExpression
	: unaryExpression functionName expression
	;

conditionalExpression
	: unaryExpression INTERR expression COLON expression
	;

primaryExpression
	: literal 																			#literalExpression
	| (OPEN_PARENS expression CLOSE_PARENS) 											#parenthesizedExpression
	| 'class' (LT identifier GT) (OPEN_PARENS expression CLOSE_PARENS)					#metaClassExpression
	// Inclusive template argument (will be parsed as a function call)
	| 'new' 		(OPEN_PARENS arguments? CLOSE_PARENS)? primaryExpression 			#newExpression
	| 'arraycount' 	(OPEN_PARENS primaryExpression CLOSE_PARENS)						#arrayCountExpression
	| 'super' 		(OPEN_PARENS identifier CLOSE_PARENS)?								#superExpression
	| 'self'																			#selfReferenceExpression
	| 'default'																			#defaultReferenceExpression
	| 'static'																			#staticAccessExpression
	| 'global'																			#globalAccessExpression
	// Note any keyword must preceed identifier!
	| identifier 																		#memberExpression
	| primaryExpression DOT classPropertyAccessSpecifier DOT identifier					#propertyAccessExpression
	| primaryExpression DOT identifier													#propertyAccessExpression
	| primaryExpression (OPEN_PARENS arguments? CLOSE_PARENS) 							#callExpression
	| primaryExpression (OPEN_BRACKET expression CLOSE_BRACKET) 						#elementAccessExpression
	;

classPropertyAccessSpecifier
	: 'default'
	| 'static'
	| 'const'
	;

// 	created(, s, test);
argument: COMMA | expression COMMA?;
arguments: argument+;

defaultPropertiesBlock
	:
		'defaultproperties'
		// UnrealScriptBug: Must be on the line after keyword!
		OPEN_BRACE
			defaultStatement*
		CLOSE_BRACE
	;

structDefaultPropertiesBlock
	:
		'structdefaultproperties'
		// UnrealScriptBug: Must be on the line after keyword!
		OPEN_BRACE
			defaultStatement*
		CLOSE_BRACE
	;

defaultStatement
	: objectDecl
	| defaultVariable
	;

objectDecl
	:
		// UnrealScriptBug: name= and class= are required to be on the same line as the keyword!
		'begin' 'object'
			defaultStatement*
		'end' 'object'
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
	| boolLiteral
	| numberLiteral
	| stringLiteral
	| objectLiteral
	| qualifiedIdentifier
	;

defaultValue
	: defaultLiteral
	| identifier
	;

operatorPrecedence: (OPEN_PARENS INTEGER CLOSE_PARENS);

functionKind
	: 'event'
	| 'function'
	| 'delegate'
	| 'preoperator'
	| 'postoperator'
	| 'operator' operatorPrecedence
	;