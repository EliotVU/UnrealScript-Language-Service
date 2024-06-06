parser grammar UCParser;

options {
    tokenVocab = UCLexer;
}

@header {
    export const enum Licensee {
        Epic = 'Epic',
        XCom = 'XCom'
    }
}

@members {
    /** Unreal Engine generation. */
    generation: number = 3;

    /** Unreal Engine build version. */
    generationVersion: number = -1;

    /** Licensee adoptation. */
    licensee: Licensee = Licensee.Epic;

    getIndex(): number {
        return this._input.index;
    }

    skipLine(i = this._input.index): void {
        let token;
        do {
            token = this._input.get(i++);
            // We cannot consume an EOF token.
            if (token.type === UCParser.EOF) {
                break;
            }
            // We need to consume, incase the stream is not filled yet.
            this._input.consume();
        } while (token.type !== UCParser.NEWLINE)
        this._input.seek(i);
    }

    isNewLine(i = this._input.index): boolean {
        const token = this._input.get(i);
        return token.type === UCParser.NEWLINE;
    }

    isKeywordToken(token: Token): boolean {
        return token.type >= UCParser.KW_DEFAULT && token.type < UCParser.ID;
    }

    isPreOperator(): boolean {
        return false;
    }

    isPostOperator(): boolean {
        return false;
    }

    isBinaryOperator(): boolean {
        // FIXME: slow, we should figure a way to hash any identifier on the lexer-phase.
        const id = this._input.LT(1).text!.toLowerCase();
        // TODO: Match to a runtime map
        if (id === 'dot' || id === 'cross' || id === 'clockwisefrom') {
            return true;
        }
        return false;
    }
}

// Class modifier keywords have been commented out, because we are not using them for parsing.
// Any captured keyword MUST be listed as a possible identifer (other wise one cannot use the keyword as identifier)
// AND any captured keyword must also have an equivalent in UCLexer.g4 such as 'const' and KW_CONST.
identifier
    : ID
    | ('default'
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
    | 'always'
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
    // Allowed but leads to many ambiguous issues
	// | 'true'
	// | 'false'
	// | 'none'
	| 'extends'
	| 'expands'
	| 'public'
	| 'protected'
	| 'protectedwrite'
	| 'private'
	| 'privatewrite'
	| 'localized'
	| 'out'
	| 'ref'
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
	| 'nativereplication'
	| 'nativeonly'
	| 'export'
	| 'abstract'
	| 'perobjectconfig'
	| 'perobjectlocalized'
	| 'placeable'
	| 'notplaceable'
	| 'nousercreate'
	| 'safereplace'
	| 'dependson'
	| 'showcategories'
	| 'hidecategories'
	| 'guid'
	| 'long'
	| 'transient'
	| 'nontransient'
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
	| 'cacheexempt'
	| 'hidedropdown'
	| 'instanced'
	| 'databinding'
	| 'duplicatetransient'
    | 'classredirect'
	| 'parseconfig'
	| 'editinlinenew'
	| 'noteditinlinenew'
	| 'exportstructs'
	| 'dllbind'
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
	| 'collapsecategories'
	| 'dontcollapsecategories'
	| 'implements'
	| 'classgroup'
	| 'autoexpandcategories'
	| 'autocollapsecategories'
	| 'dontautocollapsecategories'
	| 'dontsortcategories'
	| 'inherits'
	| 'forcescriptorder'
	| 'begin'
	| 'object'
	| 'end'
	| 'new'
	| 'goto'
	| 'assert'
	| 'vect'
	| 'rot'
	| 'rng'
    | 'arraycount'
    | 'enumcount'
    | 'sizeof')
    ;

// Parses the following possiblities.
// Package.Class
// Class.Field
// Class / Field
qualifiedIdentifier: left=identifier (DOT right=identifier)?;

/** `#identifier TEXT \n` */
directive
	: SHARP { const i = this.getIndex(); } identifier? { this.skipLine(i); }
	;

program: member* | EOF;

member
	: classDecl
    | interfaceDecl
	| constDecl
	| (enumDecl SEMICOLON)
	| (structDecl SEMICOLON)
	| varDecl
	| stateDecl
	| functionDecl
	| replicationBlock
	| defaultPropertiesBlock
	| { this.generation >= 2 }? cppText
	| directive
	| SEMICOLON
	;

literal
	: BOOLEAN_LITERAL
	| INTEGER_LITERAL
	| DECIMAL_LITERAL
	| STRING_LITERAL
	| NAME_LITERAL
	| NONE_LITERAL
	;

structLiteral
    : vectToken
	| rotToken
	| rngToken
    ;

// FIXME: Only signed if the minus or plus has no spaces in between the decimal.
// Adding this in the lexing pass causes issues with expressions,
// - such as i = 1+1; i.e. (identifier ASSIGNMENT intLiteral intLiteral SEMICOLON)
signedNumericLiteral: (MINUS | PLUS)? DOT? (DECIMAL_LITERAL | INTEGER_LITERAL);

// e.g. Class'Engine.Actor'.const.MEMBER or Texture'Textures.Group.Name'.default
objectLiteral: classRef=identifier path=NAME_LITERAL;

// Generally UC3+ but some UE2 games have this feature.
interfaceDecl
    : 'interface' identifier
        qualifiedExtendsClause?
        interfaceModifier*
        SEMICOLON
    ;

classDecl
	: 'class' identifier
        qualifiedExtendsClause?
        qualifiedWithinClause?
		classModifier*
		SEMICOLON
	;

extendsClause: ('extends' | { this.generation < 3 }? 'expands') id=identifier;
qualifiedExtendsClause: ('extends' | { this.generation < 3 }? 'expands') id=qualifiedIdentifier;
qualifiedWithinClause: 'within' id=qualifiedIdentifier;

// UC3+
interfaceModifier
    : 'native' (modifierArgument?)                                                                  #nativeInterfaceModifier
	| 'nativeonly'                                                                                  #nativeonlyInterfaceModifier

    | 'editinlinenew'                                                                               #editinlinenewInterfaceModifier
	| 'dependson' (OPEN_PARENS identifierArguments CLOSE_PARENS)                                    #dependsOnInterfaceModifier
    | (identifier modifierArguments?)                                                               #unidentifiedInterfaceModifier
    ;

classModifier
    : ('native' | { this.generation < 3 }? 'intrinsic')
        // in UC3 a class can have a custom native name.
        ({ this.generation === 3 }? modifierArgument)?                                              #nativeModifier
	| 'nativereplication'                                                                           #nativereplicationModifier
	| 'abstract'                                                                                    #abstractModifier
	| 'perobjectconfig'                                                                             #perobjectconfigModifier
	| 'transient'                                                                                   #transientModifier
	| 'config' modifierArgument?                                                                    #configModifier
    // Unreal 1 (error in UT99)
	| { this.generation === 1 }? 'localized'                                                        #localizedModifier
	| { this.generation === 1 }? 'nousercreate'                                                     #nousercreateModifier
	| { this.generation === 3 }? 'nontransient'                                                     #nontransientModifier
	| { this.generation >= 2 }? 'export'                                                            #exportModifier
	| { this.generation >= 2 }? 'noexport'                                                          #noexportModifier
	// // UC2+
    | { this.generation >= 2 }? 'placeable'                                                         #placeableModifier
	| { this.generation >= 2 }? 'notplaceable'                                                      #notplaceableModifier
    // UT2004
	| { this.generation === 2 }? 'cacheexempt'                                                      #cacheexemptModifier
	| { this.generation === 2 }? 'instanced'                                                        #instancedModifier
	| { this.generation === 2 }? 'parseconfig'                                                      #parseconfigModifier
	| { this.generation >= 2 }? 'hidedropdown'                                                      #hidedropdownModifier
	| { this.generation >= 2 }? 'exportstructs'                                                     #exportstructsModifier
	| { this.generation >= 2 }? 'editinlinenew'                                                     #editinlinenewModifier
	| { this.generation >= 2 }? 'noteditinlinenew'                                                  #noteditinlinenewModifier
	| { this.generation >= 2 }? 'dependson'
        // Multiple arguments starting with UC3
        (OPEN_PARENS identifierArguments CLOSE_PARENS)                                              #dependsOnModifier
	| { this.generation >= 2 }? 'collapsecategories' modifierArguments                              #collapsecategoriesModifier
	| { this.generation >= 2 }? 'dontcollapsecategories' modifierArguments?                         #dontcollapsecategoriesModifier
	| { this.generation >= 2 }? 'showcategories' modifierArguments                                  #showcategoriesModifier
	| { this.generation >= 2 }? 'hidecategories' modifierArguments                                  #hidecategoriesModifier
	| { this.generation < 3 }? 'guid'
        (OPEN_PARENS modifierValue COMMA modifierValue COMMA modifierValue COMMA modifierValue CLOSE_PARENS)
                                                                                                    #guidModifier
    // (error in UC3)
	| { this.generation < 3 }? 'safereplace'                                                        #safereplaceModifier
    // UC2+
    // | 'Interface'
    // | 'NoPropertySort'
	// // UC3+
	| { this.generation === 3 }? 'nativeonly'                                                       #nativeonlyModifier
	| { this.generation === 3 }? 'perobjectlocalized'                                               #perobjectlocalizedModifier
	| { this.generation === 3 }? 'deprecated'                                                       #deprecatedModifier
	| { this.generation === 3 }? 'classredirect' (OPEN_PARENS identifierArguments CLOSE_PARENS)     #classredirectModifier
	| { this.generation === 3 }? 'dllbind' modifierArgument                                         #dllbindModifier
	| { this.generation === 3 }? 'implements'
        (OPEN_PARENS qualifiedIdentifierArguments CLOSE_PARENS)                                     #implementsModifier
	| { this.generation === 3 }? 'classgroup' modifierArguments                                     #classgroupModifier
	| { this.generation === 3 }? 'autoexpandcategories' modifierArguments                           #autoexpandcategoriesModifier
	| { this.generation === 3 }? 'autocollapsecategories' modifierArguments                         #autocollapsecategoriesModifier
	| { this.generation === 3 }? 'dontautocollapsecategories' modifierArguments                     #dontautocollapsecategoriesModifier
	| { this.generation === 3 }? 'dontsortcategories' modifierArguments                             #dontsortcategoriesModifier
	| { this.generation === 3 }? 'inherits' modifierArguments                                       #inheritsModifier
	// // true/false only
	| { this.generation === 3 }? 'forcescriptorder' modifierArgument                                #forcescriptorderModifier
    // Any unrecognized modifier, too often licensees add custom modifiers, let's not bitch about these!
    | identifier modifierArguments?                                                                 #unidentifiedModifier
    ;

modifierValue
	: identifier
	| INTEGER_LITERAL
    | BOOLEAN_LITERAL
	;

modifierArgument
	: OPEN_PARENS modifierValue? CLOSE_PARENS
	;

modifierArguments
	: OPEN_PARENS (modifierValue COMMA?)* CLOSE_PARENS
	;

identifierArguments
    : (identifier COMMA?)*
    ;

qualifiedIdentifierArguments
    : (qualifiedIdentifier COMMA?)*
    ;

constDecl
	: 'const' identifier (ASSIGNMENT value=constValue)? SEMICOLON
	;

constValue
	: literal
	| signedNumericLiteral
	| objectLiteral
    | structLiteral
    // <=UC1
    // | { this.generation === 1 }? enumCountToken
	| arrayCountToken
    // UC3+
	| { this.generation === 3 }? nameOfToken
	| sizeOfToken
	;

enumCountToken
    : 'enumcount' (OPEN_PARENS expr=primaryExpression CLOSE_PARENS)
    ;

arrayCountToken
    : 'arraycount' (OPEN_PARENS expr=primaryExpression CLOSE_PARENS)
    ;

nameOfToken
    : 'nameof' (OPEN_PARENS expr=primaryExpression CLOSE_PARENS)
    ;

vectToken
	: 'vect' (OPEN_PARENS signedNumericLiteral COMMA signedNumericLiteral COMMA signedNumericLiteral CLOSE_PARENS)
	;

rotToken
	: 'rot' (OPEN_PARENS signedNumericLiteral COMMA signedNumericLiteral COMMA signedNumericLiteral CLOSE_PARENS)
	;

rngToken
	: 'rng' (OPEN_PARENS signedNumericLiteral COMMA signedNumericLiteral CLOSE_PARENS)
	;

sizeOfToken
	: 'sizeof' (OPEN_PARENS identifier CLOSE_PARENS)
	;

enumDecl:
	'enum' identifier ({ this.generation === 3 }? metaData)?
	OPEN_BRACE
		(enumMember (COMMA enumMember)* COMMA?)?
	CLOSE_BRACE
	;

enumMember
	: identifier ({ this.generation === 3 }? metaData)?
        // = value (in some licensee games)
        COMMA?
	;

structDecl
    // UE1 doesn't support qualified 'expands'
	:	'struct' ({ this.generation === 3 }? exportBlockText)? structModifier* identifier qualifiedExtendsClause?
		OPEN_BRACE
			structMember*
		CLOSE_BRACE
	;

structMember
	: constDecl
	| (enumDecl SEMICOLON)
	| (structDecl SEMICOLON)
	| varDecl
	| { this.generation === 3 }? structDefaultPropertiesBlock
	| structCppText
	| directive
	| SEMICOLON
	;

structModifier
	// UC2+ (Backported in some UE1 games)
	: 'native'
	| 'transient'
	| 'export'
	| 'init'
	| { this.generation === 2 }? 'long'                      // 2.5
	| { this.generation === 3 }? 'strictconfig'
	| { this.generation === 3 }? 'atomic'
	| { this.generation === 3 }? 'atomicwhencooked'
	| { this.generation === 3 }? 'immutable'
	| { this.generation === 3 }? 'immutablewhencooked'
	;

arrayDimRefer
	: INTEGER_LITERAL
	| qualifiedIdentifier // Referres a constant in class scope, or an enum's member.
	;

// var (GROUP)
// MODIFIER TYPE
// VARIABLE, VARIABLE...;
varDecl
	: 'var' (OPEN_PARENS categoryList? CLOSE_PARENS)?
       varType (variable (COMMA variable)*)
       SEMICOLON
	;

// id[5] {DWORD} <Order=1> "PI:Property Two:Game:1:60:Check"
variable
	: identifier (OPEN_BRACKET arrayDim=arrayDimRefer? CLOSE_BRACKET)?
	({ this.generation === 3 }? exportBlockText)?
    ({ this.generation === 3 }? metaData)?
    ({ this.generation < 3 }? optionText)? // UC2 (UT2004+, used in Pariah)
	;

optionText: STRING_LITERAL;

// UC3 <UIMin=0.0|UIMax=1.0|Toolip=Hello world!>
metaData
	: LT metaTagList? GT
	;

metaTagList
	: metaTag (BITWISE_OR metaTag)*
	;

metaTag
	: identifier (ASSIGNMENT metaText)?
	;

metaText
	: (~(BITWISE_OR | GT))*
	;

categoryList
	: identifier (COMMA identifier)*
	;

variableModifier
	: ('localized'
	| 'const'
	| 'editconst'
	| 'globalconfig'
	| 'transient'
	| 'input'
	| 'export'
	| 'native'
    | { this.generation < 3 }? 'intrinsic'
	| { this.generation < 3 }? 'travel'
	| { this.generation >= 2 }? 'deprecated'
	| { this.generation >= 2 }? 'noexport'
	| { this.generation >= 2 }? 'editinline'
	| { this.generation >= 2 }? 'editinlineuse'
	| { this.generation === 2 }? 'editconstarray'
	| { this.generation === 2 }? 'editinlinenotify'      // 2.5
	| { this.generation === 2 }? 'cache'                 // 2.5
	| { this.generation === 2 }? 'automated'             // 2.5
	| { this.generation === 2 }? 'edfindable'
    // UC2+
    // | 'nonlocalized'
	| { this.generation === 3 }? 'init'
	| { this.generation === 3 }? 'edithide'
	| { this.generation === 3 }? 'editfixedsize'
	| { this.generation === 3 }? 'editoronly'
	| { this.generation === 3 }? 'editortextbox'
	| { this.generation === 3 }? 'noclear'
	| { this.generation === 3 }? 'noimport'
	| { this.generation === 3 }? 'serializetext'
	| { this.generation === 3 }? 'nontransactional'
	| { this.generation === 3 }? 'instanced'
	| { this.generation === 3 }? 'databinding'
	| { this.generation === 3 }? 'duplicatetransient'
	| { this.generation === 3 }? 'repretry'
	| { this.generation === 3 }? 'repnotify'
	| { this.generation === 3 }? 'interp'
	| { this.generation === 3 }? 'notforconsole'
	| { this.generation === 3 }? 'archetype'
	| { this.generation === 3 }? 'crosslevelactive'
	| { this.generation === 3 }? 'crosslevelpassive'
	| { this.generation === 3 }? 'allowabstract'
    )
	// I have only attested this in XCOM2, but could possibly be a late UC3+ feature
	| 'config'             ({ this.generation === 3 }? (OPEN_PARENS identifier CLOSE_PARENS))?
	| 'public'             ({ this.generation === 3 }? exportBlockText)?
	| 'protected'          ({ this.generation === 3 }? exportBlockText)?
	| 'private'            ({ this.generation === 3 }? exportBlockText)?
	| { this.generation === 3 }? 'protectedwrite'      exportBlockText?
	| { this.generation === 3 }? 'privatewrite'        exportBlockText?
	;

varType
	: variableModifier* typeDecl
	;

typeDecl
	: primitiveType
    | stringType
	| classType
	| arrayType
	| { this.generation === 3 }? delegateType
	| mapType
	| enumDecl 		// Only allowed as a top-scope member.
	| structDecl 	// Only allowed as a top-scope member.
	| qualifiedIdentifier
	;

primitiveType
	: 'byte'
	| 'int'
	| 'float'
	| 'bool'
	| 'name'
    // Attested in UT99 v469b, UT2004 (generally a UE2 feature?)
	| { this.generation < 3 }? 'pointer'        // pointer became a struct type in UE3
	| { this.generation === 2 }? 'button'       // alias for a string with an input modifier
	;

stringType
    : 'string' (OPEN_BRACKET INTEGER_LITERAL CLOSE_BRACKET)?
    ;

// Note: inlinedDeclTypes includes another arrayGeneric!
arrayType
	: 'array' (LT varType GT)
	;

classType
	: 'class' (LT identifier GT)?
	;

delegateType
	: 'delegate' (LT qualifiedIdentifier GT)
	; // TODO: qualifiedIdentifier is hardcoded to 2 identifiers MAX.

mapType
	: 'map' ({ this.generation === 3 }? exportBlockText)?
	;

cppText
	: 'cpptext' exportBlockText
	;

structCppText
	: ({ this.generation === 3 }? 'structcpptext' | { this.generation === 2 }? 'cppstruct')
        exportBlockText
	;

// UnrealScriptBug: Anything WHATSOEVER can be written after this closing brace as long as it's on the same line!
// Skips a C++ block of text: "{ ... | { ... }* }
exportBlockText
	: OPEN_BRACE (~(OPEN_BRACE | CLOSE_BRACE)+ | exportBlockText)* CLOSE_BRACE
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
	: replicationModifier?
        // Unreal 1
        ({ this.generation === 1 }? 'always')?
        'if' (OPEN_PARENS expr=expression CLOSE_PARENS)
		    identifier (COMMA identifier)* SEMICOLON
	;

/* Parses:
 * public simulated function coerce class<Actor> test(optional int p1, int p2) const;
 */
functionDecl
	: functionSpecifier+ returnParam=functionReturnParam?
	  functionName (OPEN_PARENS params=parameters? CLOSE_PARENS) ({ this.generation === 3 }? 'const')?
	  functionBody?
	;

functionReturnParam
	: returnTypeModifier? typeDecl
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
	: localDecl
	| constDecl
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
	| 'preoperator'
	| 'postoperator'
	| 'latent'
	| 'singular'
	| 'iterator'
	| { this.generation >= 2 }? 'delegate'
	| { this.generation === 3 }? 'const'
	| { this.generation === 3 }? 'noexport'
	| { this.generation === 3 }? 'noexportheader'
	| { this.generation === 3 }? 'virtual'
	| { this.generation === 3 }? 'reliable'
	| { this.generation === 3 }? 'unreliable'
	| { this.generation === 3 }? 'server'
	| { this.generation === 3 }? 'client'
	| { this.generation === 3 }? 'dllimport'
	| { this.generation === 3 }? 'demorecording'
    | { this.generation === 3 }? 'transient'
	| { this.generation === 3 }? 'k2call'
	| { this.generation === 3 }? 'k2pure'
	| { this.generation === 3 }? 'k2override')
	| 'native'                             (OPEN_PARENS nativeToken=INTEGER_LITERAL CLOSE_PARENS)?
	| { this.generation < 3 }? 'intrinsic' (OPEN_PARENS nativeToken=INTEGER_LITERAL CLOSE_PARENS)?
	| 'operator'       (OPEN_PARENS operatorPrecedence=INTEGER_LITERAL CLOSE_PARENS)
	| 'public'         ({ this.generation === 3 }? exportBlockText)?
	| 'protected'      ({ this.generation === 3 }? exportBlockText)?
	| 'private'        ({ this.generation === 3 }? exportBlockText)?
	;

functionName: identifier | operatorName;

parameters: paramDecl (COMMA paramDecl)*;
paramDecl: paramModifier* typeDecl variable (ASSIGNMENT expr=expression)?;

returnTypeModifier
	: 'coerce' // UC3+
	;

paramModifier
	: 'out'
	| 'optional'
	| 'coerce'
	| 'skip'
	| { this.generation === 3 }? 'const'
	| { this.generation === 3 }? 'init'
    | { this.licensee === Licensee.XCom }? 'ref' // XCom or late UC3+ (Seen in other licenseed games).
	;

localDecl
	: 'local' typeDecl variable (COMMA variable)* SEMICOLON
	;

stateDecl
	: stateModifier* 'state' (OPEN_PARENS CLOSE_PARENS)? identifier extendsClause?
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
	: { this.generation === 3 }? localDecl // 3, late UDK
	| constDecl
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
	: emptyStatement
	| ifStatement
	| forStatement
	| foreachStatement
	| whileStatement
	| doStatement
	| switchStatement

	| returnStatement
	| breakStatement
	| continueStatement
	| gotoStatement

	| labeledStatement
	| assertStatement
	| stopStatement
	| constDecl

	// We must check for expressions after ALL statements so that we don't end up capturing statement keywords as identifiers.
    | assignmentStatement
	| expressionStatement
	| directive
	;

emptyStatement: SEMICOLON;

assignmentStatement: expr=assignmentExpression SEMICOLON;
expressionStatement: expr=primaryExpression SEMICOLON;

ifStatement
	: 'if' (OPEN_PARENS expr=expression? CLOSE_PARENS)
		codeBlockOptional
	  elseStatement?
	;

elseStatement: 'else' codeBlockOptional;
foreachStatement: 'foreach' expr=primaryExpression codeBlockOptional;

forStatement
	: 'for'
        OPEN_PARENS
            (initExpr=expressionWithAssignment? SEMICOLON
            condExpr=expressionWithAssignment? SEMICOLON
            nextExpr=expressionWithAssignment?)
        CLOSE_PARENS
		codeBlockOptional
	;

whileStatement
	: 'while' (OPEN_PARENS expr=expression? CLOSE_PARENS)
		codeBlockOptional
	;

doStatement
	: 'do'
		codeBlockOptional
	  ('until' (OPEN_PARENS expr=expression? CLOSE_PARENS))?
	;

switchStatement
	: 'switch' (OPEN_PARENS expr=expression? CLOSE_PARENS)
		// Note: Switch braces are NOT optional
		OPEN_BRACE
			caseClause*
			defaultClause?
		CLOSE_BRACE
	;

caseClause
	: 'case' expr=expression? COLON
		statement*
	;

defaultClause
	: 'default' COLON
		statement*
	;

returnStatement: 'return' expr=expression? SEMICOLON;
breakStatement: 'break' SEMICOLON;
continueStatement: 'continue' SEMICOLON;
stopStatement: 'stop' SEMICOLON;
labeledStatement: identifier COLON;
gotoStatement: 'goto' expr=expression? SEMICOLON;
assertStatement: 'assert' (OPEN_PARENS expr=expression? CLOSE_PARENS) SEMICOLON;

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
    // Allowed (UC1?, 2, 3), but idk any games using this.
    | COLON
    // Allowed (UC1?, 2, 3), seen this being used in some games
    // using this may however may break the parser due the intrinsic operator ?:
    | INTERR
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
	: assignmentExpression
	| primaryExpression
	;

expression
	: primaryExpression
	;

// Inclusive template argument (will be parsed as a function call)

assignmentExpression
	: left=primaryExpression id=ASSIGNMENT right=primaryExpression
	;

primaryExpression
	: primaryExpression '.' classPropertyAccessSpecifier '.' identifier						#propertyClassAccessExpression
	| primaryExpression '.' identifier?												        #propertyAccessExpression
	| primaryExpression (OPEN_PARENS arguments? CLOSE_PARENS) 								#callExpression
	| primaryExpression (OPEN_BRACKET arg=expression? CLOSE_BRACKET) 						#elementAccessExpression

	| 'new' 		(OPEN_PARENS arguments? CLOSE_PARENS)? expr=primaryExpression
                    (OPEN_PARENS templateExpr=primaryExpression CLOSE_PARENS)?              #newExpression
	| 'class' 		(LT identifier GT) (OPEN_PARENS expr=expression CLOSE_PARENS)			#metaClassExpression
	| 'arraycount' 	(OPEN_PARENS expr=primaryExpression CLOSE_PARENS)						#arrayCountExpression
	| 'super' 		(OPEN_PARENS identifier CLOSE_PARENS)?									#superExpression
	| { this.generation === 3 }?
      'nameof'      (OPEN_PARENS expr=primaryExpression CLOSE_PARENS)						#nameOfExpression

	| left=primaryExpression id=INCR 														#postOperatorExpression
	| left=primaryExpression id=DECR 														#postOperatorExpression
    // | left=primaryExpression { this.isPostOperator() }? id=identifier                       #postNamedOperatorExpression

	| id=INCR right=primaryExpression														#preOperatorExpression
	| id=DECR right=primaryExpression														#preOperatorExpression
	| id=PLUS right=primaryExpression														#preOperatorExpression
	| id=MINUS right=primaryExpression														#preOperatorExpression
	| id=TILDE right=primaryExpression														#preOperatorExpression
	| id=BANG right=primaryExpression														#preOperatorExpression
	| id=MODULUS right=primaryExpression													#preOperatorExpression
	| id=SHARP right=primaryExpression														#preOperatorExpression
	| id=DOLLAR right=primaryExpression														#preOperatorExpression
	| id=AT right=primaryExpression															#preOperatorExpression
    // | { this.isPreOperator() }? id=identifier right=primaryExpression                       #preNamedOperatorExpression

    // precedence: 16
	| left=primaryExpression { this.isBinaryOperator() }?
      id=identifier right=primaryExpression                                                 #binaryNamedOperatorExpression

	| left=primaryExpression id=EXP right=primaryExpression 								#binaryOperatorExpression
	| left=primaryExpression id=(STAR|DIV) right=primaryExpression 							#binaryOperatorExpression
	| left=primaryExpression id=MODULUS right=primaryExpression 							#binaryOperatorExpression
	| left=primaryExpression id=(PLUS|MINUS) right=primaryExpression 						#binaryOperatorExpression
	| left=primaryExpression id=(LSHIFT|RSHIFT|SHIFT) right=primaryExpression 				#binaryOperatorExpression
	| left=primaryExpression id=(LT|GT|LEQ|GEQ|EQ|IEQ) right=primaryExpression 				#binaryOperatorExpression
	| left=primaryExpression id=NEQ right=primaryExpression 								#binaryOperatorExpression
	| left=primaryExpression id=(AMP|CARET|BITWISE_OR) right=primaryExpression 				#binaryOperatorExpression
	| left=primaryExpression id=(AND|MEQ) right=primaryExpression 							#binaryOperatorExpression
	| left=primaryExpression id=OR right=primaryExpression 									#binaryOperatorExpression

    // TODO: Only valid if the conditional resolves to a boolean type.
	| <assoc=right>
      cond=primaryExpression INTERR
      left=primaryExpression COLON
      right=primaryExpression	                                                            #conditionalExpression

    // precedence: 34
    | left=primaryExpression id=(ASSIGNMENT_INCR
    | ASSIGNMENT_DECR
    | ASSIGNMENT_AND
    | ASSIGNMENT_OR
    | ASSIGNMENT_STAR
    | ASSIGNMENT_CARET
    | ASSIGNMENT_DIV) right=primaryExpression											    #assignmentOperatorExpression

    // precedence: 40 ($, @) string operators
	| left=primaryExpression id=(DOLLAR|AT) right=primaryExpression 						#binaryOperatorExpression

    // precedence: 44 ($=, @=) string operators
    | left=primaryExpression id=(ASSIGNMENT_DOLLAR|ASSIGNMENT_AT) right=primaryExpression   #assignmentOperatorExpression

    // precedence: 45 (-=) string operator
    // Leaving out because it is semantic dependant.
    // | left=primaryExpression id=(ASSIGNMENT_DECR) right=primaryExpression                   #assignmentOperatorExpression

	| 'self'																				#selfReferenceExpression
	| 'default'																				#defaultReferenceExpression
	| 'static'																				#staticAccessExpression
	| 'global'																				#globalAccessExpression

	| literal 																				#literalExpression
	| objectLiteral                                                                         #objectLiteralExpression
    | structLiteral                                                                         #structLiteralExpression

	// Note any keyword must preceed identifier!
	| identifier 																			#memberExpression

	| (OPEN_PARENS expr=primaryExpression CLOSE_PARENS) 									#parenthesizedExpression
	;

classPropertyAccessSpecifier
	: 'default'
	| 'static'
    // Also in Spellborn, and perhaps bioshock?
	| { this.generation === 3 }? 'const'
	;

argument: expression;
emptyArgument: COMMA;

// created(, s, test,,)
// (emptyArgument, argument, argument, emptyArgument)
arguments: (emptyArgument | (COMMA argument)+ | (argument COMMA?))+;

defaultArgument: COMMA | defaultValue;
defaultArguments: defaultArgument (COMMA defaultArgument)*;

// (~CLOSE_BRACE { this.notifyErrorListeners('Redundant token!'); })
defaultPropertiesBlock
	:
		'defaultproperties'
		// UnrealScriptBug: Must be on the line after keyword!
		(OPEN_BRACE
            defaultStatement*?
        CLOSE_BRACE)
	;

structDefaultPropertiesBlock
	:
		'structdefaultproperties'
		// UnrealScriptBug: Must be on the line after keyword!
		(OPEN_BRACE
            defaultStatement*?
        CLOSE_BRACE)
	;

// TODO: Perhaps do what we do in the directive rule, just skip until we hit a new line or a "|".
defaultStatement
	: defaultAssignmentExpression
	| { this.generation === 3 }? defaultMemberCallExpression
    | { this.generation >= 2 }? objectDecl

	// "command chaining", e.g. "IntA=1|IntB=2" is valid code,
	// -- but if the | were a space, the second variable will be ignored (by the compiler).
	| BITWISE_OR

	// TODO: Add a warning, from a technical point of view,
	// -- the UC compiler just skips any character till it hits a newline character.
	| SEMICOLON

    // | ~(BITWISE_OR | SEMICOLON)
	;

defaultExpression
	: identifier (OPEN_BRACKET arg=defaultConstantArgument? CLOSE_BRACKET)				#defaultElementAccessExpression
	| identifier (OPEN_PARENS arg=defaultConstantArgument? CLOSE_PARENS)				#defaultElementAccessExpression
	| identifier																        #defaultMemberExpression
	;

/**
 * Parses an array index like MyArray(Numeric|Const|Enum)
 * 0|0.0|identifier
 */
defaultConstantArgument
	: INTEGER_LITERAL
	| DECIMAL_LITERAL
	| defaultIdentifierRef
	;

defaultAssignmentExpression
	: defaultExpression ASSIGNMENT ((OPEN_BRACE defaultValue? CLOSE_BRACE) | defaultValue)
	;

defaultMemberCallExpression
	: identifier DOT propId=identifier (OPEN_PARENS defaultArguments? CLOSE_PARENS)?
	;

objectDecl
	:
		// UnrealScriptBug: name= and class= are required to be on the same line as the keyword!
		('begin' 'object') objectAttribute+
            defaultStatement*?
		('end' 'object')
	;

objectAttribute
	: id=KW_NAME ASSIGNMENT value=identifier
	| id=KW_CLASS ASSIGNMENT value=identifier
    // Probably deprecated, but this attribute is still in use in some UDK classes.
    // | id='legacyclassname'

    // Seems to be absent, but it does compile and will override name=
    // | id='objname'

    // Is this feature used anywhere?
    // | id='archetype' ASSIGNMENT value=identifier '\'' identifier
	;

// (variableList)
defaultStructLiteral
	: OPEN_PARENS defaultArgumentsLiteral? CLOSE_PARENS
	;

// id=literal,* or literal,*
defaultArgumentsLiteral
	: (defaultAssignmentExpression (COMMA defaultAssignmentExpression)* COMMA?)
	| (defaultValue (COMMA defaultValue)* COMMA?)
	;

defaultIdentifierRef
	: identifier
	;

defaultQualifiedIdentifierRef
	: identifier (DOT identifier)+
	;

defaultValue
	: literal
    | signedNumericLiteral
	| objectLiteral
	| defaultQualifiedIdentifierRef
	| defaultIdentifierRef
    | defaultStructLiteral
	;

testDefaultValue
    : OPEN_BRACE (defaultValue SEMICOLON)+ CLOSE_BRACE
    ;
