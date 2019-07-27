grammar UCGrammar;

import UCLexer;

// Class modifier keywords have been commented out, because we are not using them for parsing.
identifier
	: ID
	| 'default'
	| 'self'
	| 'super'
	| 'global'
	| 'class'
	| 'interface'
	| 'within'
	| 'const'
	| 'enum'
	| 'struct'
	| 'var'
	| 'local'
	| 'replication'
	| 'operator'
	| 'preoperator'
	| 'postoperator'
	| 'delegate'
	| 'function'
	| 'event'
	| 'state'
	| 'map'
	| 'defaultproperties'
	| 'structdefaultproperties'
	| 'for'
	| 'foreach'
	| 'return'
	| 'break'
	| 'continue'
	| 'stop'
	| 'case'
	| 'switch'
	| 'until'
	| 'do'
	| 'while'
	| 'else'
	| 'if'
	| 'ignores'
	| 'unreliable'
	| 'reliable'
	| 'cpptext'
	| 'cppstruct'
	| 'structcpptext'
	| 'array'
	| 'byte'
	| 'int'
	| 'float'
	| 'string'
	| 'pointer'
	| 'button'
	| 'bool'
	| 'name'
	| 'true'
	| 'false'
	| 'none'
	| 'extends'
	| 'expands'
	| 'public'
	| 'protected'
	| 'protectedwrite'
	| 'private'
	| 'privatewrite'
	| 'localized'
	| 'out'
	| 'optional'
	| 'init'
	| 'skip'
	| 'coerce'
	| 'final'
	| 'latent'
	| 'singular'
	| 'static'
	| 'exec'
	| 'iterator'
	| 'simulated'
	| 'auto'
	| 'noexport'
	| 'noexportheader'
	| 'editconst'
	| 'edfindable'
	| 'editinline'
	| 'editinlinenotify'
	| 'editinlineuse'
	| 'edithide'
	| 'editconstarray'
	| 'editfixedsize'
	| 'editoronly'
	| 'editortextbox'
	| 'noclear'
	| 'noimport'
	| 'nontransactional'
	| 'serializetext'
	| 'config'
	| 'globalconfig'
	| 'intrinsic'
	| 'native'
	// |'nativereplication'
	// |'nativeonly'
	| 'export'
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
	| 'long'
	| 'transient'
	// |'nontransient'
	| 'cache'
	| 'interp'
	| 'repretry'
	| 'repnotify'
	| 'notforconsole'
	| 'archetype'
	| 'crosslevelactive'
	| 'crosslevelpassive'
	| 'allowabstract'
	| 'automated'
	| 'travel'
	| 'input'
	// |'cacheexempt'
	// |'hidedropdown'
	| 'instanced'
	| 'databinding'
	| 'duplicatetransient'
	// |'parseconfig'
	// |'editinlinenew'
	// |'noteditinlinenew'
	// |'exportstructs'
	// |'dllbind'
	| 'deprecated'
	| 'strictconfig'
	| 'atomic'
	| 'atomicwhencooked'
	| 'immutable'
	| 'immutablewhencooked'
	| 'virtual'
	| 'server'
	| 'client'
	| 'dllimport'
	| 'demorecording'
	| 'k2call'
	| 'k2pure'
	| 'k2override'
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
	| 'begin'
	| 'object'
	| 'end'
	| 'new'
	| 'goto'
	| 'assert'
	| 'vect'
	| 'rot'
	| 'rng'
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
	: boolLiteral
	| intLiteral
	| floatLiteral
	| stringLiteral
	| noneLiteral
	| nameLiteral
	| vectToken
	| rotToken
	| rngToken
	| nameOfToken
	| objectLiteral
	;

floatLiteral: (MINUS | PLUS)? FLOAT;
intLiteral: (MINUS | PLUS)? INTEGER;

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

modifierArgument
	: OPEN_PARENS modifierValue CLOSE_PARENS
	;

modifierArguments
	: OPEN_PARENS (modifierValue COMMA?)+ CLOSE_PARENS
	;

constDecl
	: 'const' identifier ASSIGNMENT constValue SEMICOLON
	;

constValue
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
		(enumMember (COMMA enumMember)* COMMA?)?
	CLOSE_BRACE
	;

enumMember
	: identifier metaData? COMMA?
	;

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

arrayDimRefer
	: INTEGER
	| qualifiedIdentifier // Referres a constant in class scope, or an enum's member.
	;

// var (GROUP)
// MODIFIER TYPE
// VARIABLE, VARIABLE...;
varDecl
	: 'var' (OPEN_PARENS categoryList? CLOSE_PARENS)?
	variableModifier* inlinedDeclTypes
	variable (COMMA variable)* SEMICOLON
	;

// id[5] {DWORD} <Order=1>
variable
	: identifier (OPEN_BRACKET arrayDim=arrayDimRefer? CLOSE_BRACKET)?
	exportBlockText?
	metaData?
	;

// UC3 <UIMin=0.0|UIMax=1.0|Toolip=Hello world!>
metaData
	: LT metaTag* GT
	;

metaTag
	: identifier ASSIGNMENT ((~(BITWISE_OR | GT)) | metaTag)
	;

categoryList
	: identifier (COMMA identifier)*
	;

variableModifier
	: ('localized'
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
	| 'allowabstract')
	| ('public' exportBlockText?)
	| ('protected' exportBlockText?)
	| ('protectedwrite' exportBlockText?)
	| ('private' exportBlockText?)
	| ('privatewrite' exportBlockText?)
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
arrayType
	: 'array' (LT inlinedDeclTypes GT)
	;

classType
	: 'class' (LT identifier GT)?
	;

delegateType
	: 'delegate' (LT qualifiedIdentifier GT)
	; // TODO: qualifiedIdentifier is hardcoded to 2 identifiers MAX.

mapType
	: 'map' exportBlockText
	;

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
functionDecl
	: functionSpecifier+ (returnTypeModifier? returnType=typeDecl)?
	  functionName (OPEN_PARENS params=parameters? CLOSE_PARENS) 'const'?
	  functionBody
	;

functionBody
	: SEMICOLON
	| (OPEN_BRACE
		functionMember*
		statement*
	  CLOSE_BRACE)
	;

/* Parses:
 * { local Actor test, test2; return test.Class; }
 */
functionMember
	: constDecl
	| localDecl
	| directive
	| SEMICOLON
	;

functionSpecifier
	: ('function'
	| 'simulated'
	| 'static'
	| 'exec'
	| 'final'
	| 'event'
	| 'delegate'
	| 'preoperator'
	| 'postoperator'
	| 'latent'
	| 'singular'
	| 'iterator'
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
	| 'k2override')
	| ('native' (OPEN_PARENS nativeToken=INTEGER CLOSE_PARENS)?)
	| ('operator' (OPEN_PARENS operatorPrecedence=INTEGER CLOSE_PARENS))
	| ('public' exportBlockText?)
	| ('protected' exportBlockText?)
	| ('private' exportBlockText?)
	;

functionName: identifier | operatorName;

parameters: paramDecl (COMMA paramDecl)*;
paramDecl: paramModifier* typeDecl variable (ASSIGNMENT expression)?;

returnTypeModifier
	: 'coerce' // UC3+
	;

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

	| breakStatement
	| continueStatement
	| returnStatement
	| gotoStatement

	| labeledStatement
	| assertStatement
	| stopStatement
	| constDecl

	// We must check for expressions after ALL statements so that we don't end up capturing statement keywords as identifiers.
	| expressionStatement
	| directive
	;

expressionStatement: expressionWithAssignment SEMICOLON;

ifStatement
	: 'if' (OPEN_PARENS expression CLOSE_PARENS)
		codeBlockOptional
	  elseStatement?
	;

elseStatement: 'else' codeBlockOptional;
foreachStatement: 'foreach' primaryExpression codeBlockOptional;

forStatement
	: 'for' (OPEN_PARENS (initExpr=expressionWithAssignment SEMICOLON) (condExpr=expressionWithAssignment SEMICOLON) nextExpr=expressionWithAssignment CLOSE_PARENS)
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

returnStatement: 'return' expression? SEMICOLON;
breakStatement: 'break' SEMICOLON;
continueStatement: 'continue' SEMICOLON;
stopStatement: 'stop' SEMICOLON;
labeledStatement: identifier COLON;
gotoStatement: 'goto' expression SEMICOLON;
assertStatement: 'assert' (OPEN_PARENS expression CLOSE_PARENS) SEMICOLON;

// Valid assignment operators (that can be overloaded)
assignmentOperator
	: ASSIGNMENT_INCR
	| ASSIGNMENT_DECR
	| ASSIGNMENT_AT
	| ASSIGNMENT_DOLLAR
	| ASSIGNMENT_AND
	| ASSIGNMENT_OR
	| ASSIGNMENT_STAR
	| ASSIGNMENT_CARET
	| ASSIGNMENT_DIV
	;

// Valid pre operators
preOperator
	: INCR
	| DECR
	| PLUS
	| MINUS
	| TILDE
	| BANG
	| AT
	| DOLLAR
	| AMP
	| MODULUS
	| SHARP
	| identifier
	;

// Valid post operators
postOperator
	: INCR
	| DECR
	| TILDE
	| BANG
	| AT
	| DOLLAR
	| AMP
	| MODULUS
	| SHARP
	| identifier
	;

// Valid operators
binaryOperator
	: EXP
	| STAR
	| DIV
	| MODULUS
	| PLUS
	| MINUS
	| LSHIFT
	| RSHIFT
	| SHIFT
	| LT
	| GT
	| LEQ
	| GEQ
	| EQ
	| NEQ
	| IEQ
	| MEQ
	| AMP
	| CARET
	| BITWISE_OR
	| AND
	| OR
	| AT
	| DOLLAR
	| identifier
	;

// All valid operator names (for declarations)
operatorName
	: STAR
	| DIV
	| MODULUS
	| PLUS
	| MINUS
	| LSHIFT
	| RSHIFT
	| SHIFT
	| DOLLAR
	| AT
	| SHARP
	| BANG
	| AMP
	| BITWISE_OR
	| CARET
	| INCR
	| DECR
	| TILDE
	| EXP
	| LT
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

expressionWithAssignment
	: conditionalExpression
	| assignmentExpression
	| assignmentOperatorExpression
	| unaryExpression
	;

expression
	: conditionalExpression
	| unaryExpression
	;

// Inclusive template argument (will be parsed as a function call)

assignmentExpression
	: primaryExpression ASSIGNMENT expression
	;

assignmentOperatorExpression
	: primaryExpression assignmentOperator expression
	;

// Messy... but due the nature of UnrealScript, our metaClass cast can be misstaken for a binaryOperatorExpression, so we have to preceed this check,
// - leading to even more issues,
// - UNLESS we add the binary expression within an unary expression.
// i.e. in UC, any pre/post or binary operator can be declared and used as an identifier, thus "class" could be a preoperator etc.
// FIXME: Think of a fitting name, now that this rule includes a binaryExpression structure :/
unaryExpression
	: unaryExpression binaryOperator unaryExpression 						#binaryOperatorExpression
	| unaryExpression postOperator											#postOperatorExpression
	| primaryExpression														#singleExpression
	| preOperator unaryExpression											#preOperatorExpression
	;

conditionalExpression
	: unaryExpression INTERR expression COLON expression
	;

primaryExpression
	: primaryExpression '.' classPropertyAccessSpecifier '.' identifier					#propertyAccessExpression
	| primaryExpression '.' identifier													#propertyAccessExpression
	| primaryExpression (OPEN_PARENS arguments? CLOSE_PARENS) 							#callExpression
	| primaryExpression (OPEN_BRACKET expression CLOSE_BRACKET) 						#elementAccessExpression
	| literal 																			#literalExpression
	| 'class' (LT identifier GT) (OPEN_PARENS expression CLOSE_PARENS)					#metaClassExpression
	| 'new' (OPEN_PARENS arguments? CLOSE_PARENS)? primaryExpression					#newExpression
	| 'arraycount' 	(OPEN_PARENS primaryExpression CLOSE_PARENS)						#arrayCountExpression
	| 'super' 		(OPEN_PARENS identifier CLOSE_PARENS)?								#superExpression
	| 'self'																			#selfReferenceExpression
	| 'default'																			#defaultReferenceExpression
	| 'static'																			#staticAccessExpression
	| 'global'																			#globalAccessExpression
	// Note any keyword must preceed identifier!
	| identifier 																		#memberExpression
	| (OPEN_PARENS expression CLOSE_PARENS) 											#parenthesizedExpression
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
	| defaultAssignmentExpression
	;

defaultExpression
	: identifier DOT defaultExpression 							#defaultPropertyAccessExpression
	| identifier (OPEN_PARENS INTEGER CLOSE_PARENS)				#defaultElementAccessExpression
	| identifier (OPEN_PARENS arguments? CLOSE_PARENS )			#defaultCallExpression
	| identifier (OPEN_BRACKET INTEGER CLOSE_BRACKET)			#defaultElementAccessExpression
	| identifier												#defaultMemberExpression
	;

defaultAssignmentExpression
	: defaultExpression ASSIGNMENT ((OPEN_BRACE defaultLiteral CLOSE_BRACE) | defaultLiteral)
	;

objectDecl
	:
		// UnrealScriptBug: name= and class= are required to be on the same line as the keyword!
		'begin' 'object'
			defaultStatement*
		'end' 'object'
	;

// (variableList)
structLiteral
	: OPEN_PARENS defaultArguments? CLOSE_PARENS
	;

// id=literal,* or literal,*
defaultArguments
	: (defaultLiteral (COMMA defaultLiteral)*)
	| (defaultAssignmentExpression (COMMA defaultAssignmentExpression)*)
	;

defaultLiteral
	: structLiteral
	| noneLiteral
	| boolLiteral
	| floatLiteral
	| intLiteral
	| stringLiteral
	| objectLiteral
	| qualifiedIdentifier
	;