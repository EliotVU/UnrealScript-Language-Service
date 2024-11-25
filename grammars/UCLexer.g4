lexer grammar UCLexer;

channels { MACRO, COMMENTS_CHANNEL }

@lexer::header {
    import { IntStream } from 'antlr4ts';

    // TODO: Create a map of keyword tokens?
}

@lexer::members {
    parensLevel: number = 0;
    braceLevel: number = 0;

    // For debugging

    // override nextToken() {
    //     const token = super.nextToken();

    //     console.debug('<< ' + token.text);

    //     return token;
    // }

    // override mode(m: number): void {
    //     super.mode(m);

    //     console.debug('switch mode', this.modeNames[m], this._modeStack.toArray().map(ms => this.modeNames[ms]).join('->'));
    // }

    // override popMode(): number {
    //     const m = super.popMode();

    //     console.debug('pop mode', this.modeNames[m], this._modeStack.toArray().map(ms => this.modeNames[ms]).join('->'));

    //     return m;
    // }

    // override pushMode(m: number): void {
    //     super.pushMode(m);

    //     console.debug('push mode', this.modeNames[m], this._modeStack.toArray().map(ms => this.modeNames[ms]).join('->'));
    // }
}

fragment DIGIT
    : [0-9]
    ;

fragment HEX_DIGIT
    : [0-9a-fA-F]
    ;

fragment SIGN
    : [+-]
    ;

fragment EXPONENT
    : [eE] SIGN? DIGIT+
    ;

fragment FLOAT_TYPE_SUFFIX
    : [fF]
    ;

fragment ESC_SEQ
    : '\\' .
    ;

fragment CALL_MACRO_CHAR
    : '\u0060'
    ;

fragment MACRO_NAME_CHARACTER
    : [a-zA-Z_\u00C0-\u00FF\u009F\u008C\u009C]
    ;

LINE_COMMENT
    : '//' ~[\r\n]*
    -> channel(COMMENTS_CHANNEL) //, pushMode(LINE_COMMENT_MODE)
    ;

BLOCK_COMMENT
    : '/*' (BLOCK_COMMENT|.)*? '*/'
    -> channel(COMMENTS_CHANNEL) //, pushMode(BLOCK_COMMENT_MODE)
    ;

WS
    : [ \t]+
    -> channel(HIDDEN)
    ;

NEWLINE
    : '\r'? '\n'
    -> channel(HIDDEN)
    ;

MACRO_CHAR_ENCLOSED
    : CALL_MACRO_CHAR { this._input.LA(1) === '{'.charCodeAt(0) }?
    -> channel(MACRO), type(MACRO_CHAR), pushMode(MACRO_ENCLOSED_MODE)
    ;

MACRO_CHAR
    : CALL_MACRO_CHAR
    -> channel(MACRO), pushMode(MACRO_MODE)
    ;

DECIMAL_LITERAL
    : DIGIT+ '.' [0-9fF]* EXPONENT? FLOAT_TYPE_SUFFIX?
    | DIGIT+ (FLOAT_TYPE_SUFFIX | EXPONENT FLOAT_TYPE_SUFFIX?)
    ;

INTEGER_LITERAL
    : DIGIT+ [xX] HEX_DIGIT+
    | DIGIT+
    ;

STRING_LITERAL: '"' (~["\\] | ESC_SEQ)* '"';
NAME_LITERAL: '\'' (~['\\] | ESC_SEQ)* '\'';
BOOLEAN_LITERAL: 'true' | 'false';
NONE_LITERAL: 'none';

KW_DEFAULT: 'default';
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
KW_STATE: 'state';
KW_MAP: 'map';
KW_DEFAULTPROPERTIES: 'defaultproperties';
KW_STRUCTDEFAULTPROPERTIES: 'structdefaultproperties';
KW_FOR: 'for';
KW_FOREACH: 'foreach';
KW_RETURN: 'return';
KW_BREAK: 'break';
KW_CONTINUE: 'continue';
KW_STOP: 'stop';
KW_CASE: 'case';
KW_SWITCH: 'switch';
KW_UNTIL: 'until';
KW_DO: 'do';
KW_WHILE: 'while';
KW_ELSE: 'else';
KW_IF: 'if';
KW_IGNORES: 'ignores';
KW_UNRELIABLE: 'unreliable';
KW_RELIABLE: 'reliable';
KW_ALWAYS: 'always';
KW_CPPTEXT: 'cpptext';
KW_STRUCTCPPTEXT: 'structcpptext';
KW_CPPSTRUCT: 'cppstruct';
KW_ARRAY: 'array';
KW_BYTE: 'byte';
KW_FLOAT: 'float';
KW_INT: 'int';
KW_STRING: 'string';
KW_NAME: 'name';
KW_BOOL: 'bool';
KW_POINTER: 'pointer';
KW_BUTTON: 'button';
KW_EXTENDS: 'extends';
KW_PUBLIC: 'public';
KW_PROTECTED: 'protected';
KW_PROTECTEDWRITE: 'protectedwrite';
KW_PRIVATE: 'private';
KW_PRIVATEWRITE: 'privatewrite';
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
KW_NOEXPORTHEADER: 'noexportheader';
KW_EDITCONST: 'editconst';
KW_EDFINDABLE: 'edfindable';
KW_EDITINLINE: 'editinline';
KW_EDITINLINENOTIFY: 'editinlinenotify';
KW_EDITINLINEUSE: 'editinlineuse';
KW_EDITINLINENEW: 'editinlinenew';
KW_NOTEDITINLINENEW: 'noteditinlinenew';
KW_EXPORTSTRUCTS: 'exportstructs';
KW_DLLBIND: 'dllbind';
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
KW_NATIVE: 'native';
KW_NATIVEREPLICATION: 'nativereplication';
KW_NATIVEONLY: 'nativeonly';
KW_INTRINSIC: 'intrinsic';
KW_EXPORT: 'export';
KW_PLACEABLE: 'placeable';
KW_NOTPLACEABLE: 'notplaceable';
KW_NOUSERCREATE: 'nousercreate';
KW_SAFEREPLACE: 'safereplace';
KW_LONG: 'long';
KW_TRANSIENT: 'transient';
KW_NONTRANSIENT: 'nontransient';
KW_ABSTRACT: 'abstract';
KW_PEROBJECTCONFIG: 'perobjectconfig';
KW_PEROBJECTLOCALIZED: 'perobjectlocalized';
KW_CACHE: 'cache';
KW_INTERP: 'interp';
KW_REPRETRY: 'repretry';
KW_REPNOTIFY: 'repnotify';
KW_NOTFORCONSOLE: 'notforconsole';
KW_ARCHETYPE: 'archetype';
KW_CROSSLEVELACTIVE: 'crosslevelactive';
KW_CROSSLEVELPASSIVE: 'crosslevelpassive';
KW_ALLOWABSTRACT: 'allowabstract';
KW_AUTOMATED: 'automated';
KW_TRAVEL: 'travel';
KW_Input: 'input';
KW_CACHEEXEMPT: 'cacheexempt';
KW_HIDEDROPDOWN: 'hidedropdown';
KW_INSTANCED: 'instanced';
KW_DATABINDING: 'databinding';
KW_DUPLICATETRANSIENT: 'duplicatetransient';
KW_PARSECONFIG: 'parseconfig';
KW_CLASSREDIRECT: 'classredirect';
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
KW_GOTO: 'goto';
KW_ASSERT: 'assert';
KW_FORCESCRIPTORDER: 'forcescriptorder';
KW_BEGIN: 'begin';
KW_OBJECT: 'object';
KW_END: 'end';
KW_FUNCTION: 'function';
KW_EVENT: 'event';
KW_DELEGATE: 'delegate';
KW_OPERATOR: 'operator';
KW_PREOPERATOR: 'preoperator';
KW_POSTOPERATOR: 'postoperator';
KW_SELF: 'self';
KW_SUPER: 'super';
KW_EXPANDS: 'expands';
KW_IMPLEMENTS: 'implements';
KW_CLASSGROUP: 'classgroup';
KW_DEPENDSON: 'dependson';
KW_SHOWCATEGORIES: 'showcategories';
KW_HIDECATEGORIES: 'hidecategories';
KW_COLLAPSECATEGORIES: 'collapsecategories';
KW_DONTCOLLAPSECATEGORIES: 'dontcollapsecategories';
KW_AUTOEXPANDCATEGORIES: 'autoexpandcategories';
KW_AUTOCOLLAPSECATEGORIES: 'autocollapsecategories';
KW_DONTAUTOCOLLAPSECATEGORIES: 'dontautocollapsecategories';
KW_DONTSORTCATEGORIES: 'dontsortcategories';
KW_INHERITS: 'inherits';
KW_GUID: 'guid';
KW_K2CALL: 'k2call';
KW_K2PURE: 'k2pure';
KW_K2OVERRIDE: 'k2override';
KW_NEW: 'new';
KW_VECT: 'vect';
KW_ROT: 'rot';
KW_RNG: 'rng';
KW_ARRAYCOUNT: 'arraycount';
KW_ENUMCOUNT: 'enumcount';
KW_NAMEOF: 'nameof';
KW_SIZEOF: 'sizeof';
KW_REF: 'ref';

// Note: Keywords must precede the ID token.
ID:	[a-zA-Z_][a-zA-Z0-9_]*;
// ID:	[a-z_][a-z0-9_]*;

ESCAPE: '\\';

OPEN_PARENS: '(';
CLOSE_PARENS: ')';

OPEN_BRACE: '{';
CLOSE_BRACE: '}';

OPEN_BRACKET: '[';
CLOSE_BRACKET: ']';

SEMICOLON: ';';
COMMA: ',';

COLON: ':';
INTERR: '?';

SQUOT: '\'';

SHARP: '#';
PLUS: '+';
MINUS: '-';
DOT: '.';
AT: '@';
DOLLAR: '$';
BANG: '!';
AMP: '&';
BITWISE_OR: '|';
STAR: '*';
CARET: '^';
DIV: '/';
MODULUS: '%';
TILDE: '~';

LT: '<';
GT: '>';
OR: '||';
AND: '&&';
EQ: '==';
NEQ: '!=';
GEQ: '>=';
LEQ: '<=';
IEQ: '~=';
MEQ: '^^';

INCR: '++';
DECR: '--';
EXP: '**';
RSHIFT: '>>';
LSHIFT: '<<';
SHIFT: '>>>';

ASSIGNMENT: '=';
ASSIGNMENT_INCR: '+=';
ASSIGNMENT_DECR: '-=';
ASSIGNMENT_AT: '@=';
ASSIGNMENT_DOLLAR: '$=';
ASSIGNMENT_AND: '&=';
ASSIGNMENT_OR: '|=';
ASSIGNMENT_STAR: '*=';
ASSIGNMENT_CARET: '^=';
ASSIGNMENT_DIV: '/=';

ERROR: . -> channel(HIDDEN);

mode MACRO_ENCLOSED_MODE;

MACRO_OPEN_BRACE
    : '{'
    {
        ++this.braceLevel;
    }
    -> channel(MACRO), type(OPEN_BRACE), mode(MACRO_MODE)
    ;

mode MACRO_MODE;

MACRO_CLOSE_BRACE
    : '}'
    {
        if (--this.braceLevel === 0) {
            this.popMode();
        }
    }
    -> channel(MACRO), type(CLOSE_BRACE)
    ;

// ! Valid?
MACRO_SINGLE_LINE_COMMENT:  '//' ~[\r\n]*               -> channel(COMMENTS_CHANNEL), type(LINE_COMMENT);

MACRO_INCLUDE:              'include'                   -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_DEFINE:               'define'                    -> channel(MACRO), mode(MACRO_DEFINE_MODE);
MACRO_UNDEFINE:             'undefine'                  -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_IS_DEFINED:           'isdefined'                 -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_NOT_DEFINED:          'notdefined'                -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_COUNTER:              'counter'                   -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_GET_COUNTER:          'getcounter'                -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_SET_COUNTER:          'setcounter'                -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_IF:                   'if'                        -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_ELSE:                 'else'                      -> channel(MACRO), popMode;
MACRO_ELSE_IF:              'elseif'                    -> channel(MACRO), mode(MACRO_INVOKE_MODE);
MACRO_END_IF:               'endif'                     -> channel(MACRO), popMode;
// Hardcoded (also case-sensitive), checked in the parser instead...
// MACRO_LINE:                  '__LINE__'                  -> channel(MACRO);
// MACRO_FILE:                  '__FILE__'                  -> channel(MACRO);

MACRO_SYMBOL_INVOKE
    : [a-zA-Z_][a-zA-Z0-9_#]*
    { this._input.LA(1) === '('.charCodeAt(0) }?
    -> channel(MACRO), type(MACRO_SYMBOL), mode(MACRO_INVOKE_MODE)
    ;

MACRO_SYMBOL
    : [a-zA-Z_][a-zA-Z0-9_#]*
    {
        if (this.braceLevel === 0) {
            this.popMode();
        }
    }
    -> channel(MACRO)
    ;

MACRO_NEW_LINE
    : [\r\n]+
    {
        this.parensLevel = 0;
        this.braceLevel = 0;
    }
    -> channel(HIDDEN), type(NEWLINE), popMode, mode(DEFAULT_MODE)
    ;

MACRO_END: . -> more, popMode;

// << MACRO_CHAR 'DEFINE'
mode MACRO_DEFINE_MODE; // >> MACRO_DEFINE_WS MACRO_DEFINE_SYMBOL[MACRO_DEFINE_PARAMS_MODE]? MACRO_TEXT_MODE?

MACRO_DEFINE_WS
    : [ \t]+
    -> channel(HIDDEN), type(WS)
    ;

MACRO_DEFINE_CALL_SYMBOL
    : MACRO_NAME_CHARACTER+
    { this._input.LA(1) === '('.charCodeAt(0) }?
    -> channel(MACRO), type(MACRO_DEFINE_SYMBOL), mode(MACRO_DEFINE_PARAMS_MODE)
    ;

MACRO_DEFINE_SYMBOL
    : MACRO_NAME_CHARACTER+
    -> channel(MACRO), mode(MACRO_TEXT_MODE)
    ;

// << MACRO_DEFINE_SYMBOL
mode MACRO_DEFINE_PARAMS_MODE; // >> WS OPEN_PARENS MACRO_SYMBOL

MACRO_DEFINE_PARAMS_OPEN_PARENS
    : '('
    -> channel(MACRO), type(OPEN_PARENS)
    ;

MACRO_DEFINE_PARAMS_SYMBOL
    : MACRO_NAME_CHARACTER+
    -> channel(MACRO), type(MACRO_SYMBOL)
    ;

MACRO_DEFINE_PARAMS_COMMA
    : ','
    -> channel(MACRO), type(COMMA)
    ;

MACRO_DEFINE_PARAMS_CLOSE_PARENS
    : ')'
    -> channel(MACRO), type(CLOSE_PARENS), mode(MACRO_TEXT_MODE)
    ;

MACRO_DEFINE_PARAMS_WS
    : [ \t]+
    -> channel(HIDDEN), type(WS)
    ;

// Unexpected, but in case of incomplete code we must fail early.
MACRO_DEFINE_PARAMS_NEW_LINE
    : [\r\n]+
    {
        this.parensLevel = 0;
        this.braceLevel = 0;
    }
    -> channel(HIDDEN), type(NEWLINE), mode(DEFAULT_MODE)
    ;

// << `MACRO_SYMBOL
mode MACRO_INVOKE_MODE; // >> (MACRO_ARGUMENTS_MODE? | \n)`

MACRO_INVOKE_OPEN_PARENS
    : '('
    -> channel(MACRO), type(OPEN_PARENS), mode(MACRO_ARGUMENTS_MODE)
    ;

MACRO_INVOKE_CLOSE_PARENS
    : ')'
    -> channel(MACRO), type(CLOSE_PARENS), popMode
    ;

// << MACRO_INVOKE_MODE
mode MACRO_ARGUMENTS_MODE; // >> MACRO_ARGUMENT_MODE [,\MACRO_ARGUMENT_MODE]

MACRO_ARGUMENTS_COMMA
    : ','
    -> channel(MACRO), type(COMMA)
    ;

MACRO_ARGUMENTS_WS
    : [ \t]+
    -> channel(HIDDEN), type(WS)
    ;

// Consume all symbols untill the last ')' or first ',' (except when nested)
MACRO_ARGUMENTS_SYMBOL
    : .
    // Do this stuff manually, it gets too complicated with nested modes
    // Parses:
    // `func(("" $ ",") $ ";", ("arg2"))
    // >> MACRO_CHAR MACRO_SYMBOL OPEN_PARENS MACRO_SYMBOL COMMA MACRO_SYMBOL CLOSE_PARENS
    {
        // Undo whatever we have matched by anything char '.'
        --(this._input as any)._position;

        let nest = 0;

        while (true) {
            const charCode = this._input.LA(1);
            switch (charCode) {
                case IntStream.EOF:
                    return;

                case 40://'('.charCodeAt(0):
                    ++nest;
                    break;

                case 41://')'.charCodeAt(0):
                    // Final ')'?
                    if (nest === 0) {
                        this.channel = UCLexer.MACRO;
                        this.type = UCLexer.MACRO_SYMBOL;
                        this.mode(UCLexer.MACRO_INVOKE_MODE);
                        this.emit();

                        return;
                    }

                    --nest;
                    break;

                case 44://','.charCodeAt(0):
                    // Argument ending ','?
                    if (nest === 0) {
                        this.channel = UCLexer.MACRO;
                        this.type = UCLexer.MACRO_SYMBOL;
                        this.emit();

                        return;
                    }

                    break;
            }

            this._input.consume();
        }
    }
    -> channel(MACRO), type(MACRO_SYMBOL)
    ;

mode MACRO_TEXT_MODE; // << MACRO_TEXT*

MACRO_TEXT
    : (~[\n]*? '\\' '\r'? '\n')* ~[\n]+
    // Exclude the first whitespace character.
    {
        this.text = this.text.trimLeft();
    }
    -> channel(MACRO)
    ;

MACRO_TEXT_NEW_LINE
    : [\r\n]+
    {
        this.parensLevel = 0;
        this.braceLevel = 0;
    }
    -> channel(HIDDEN), type(NEWLINE), popMode
    ;

mode LINE_COMMENT_MODE;

COMMENT_TEXT
    : ~[\r\n]+
    -> popMode
    ;

COMMENT_END
    : [\r\n]
    -> popMode
    ;
