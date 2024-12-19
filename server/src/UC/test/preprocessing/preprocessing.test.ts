import { expect } from "chai";
import { readTextByURI } from "../../../workspace";
import { UCInputStream } from "../../Parser/InputStream";
import { createMacroProvider } from '../../Parser/MacroProvider';
import { createTokenStream } from '../../Parser/PreprocessorParser';
import { textToTokens } from '../../Parser/preprocessor';
import { TRANSIENT_PACKAGE, UCSymbolKind } from '../../Symbols';
import { UCLexer } from "../../antlr/generated/UCLexer";
import { UCParser } from '../../antlr/generated/UCParser';
import { UCDocument } from '../../document';
import { indexDocument, queueIndexDocument } from "../../indexer";
import { toName } from '../../name';
import { assertDocumentFieldSymbol } from '../utils/codeAsserts';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentNodes, assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { assertTokens, usingDocuments } from "../utils/utils";
import path = require('node:path');

describe("Preprocessing", () => {
    it('should expand `__LINE__', () => {
        assertTokens(`\`__LINE__`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.INTEGER_LITERAL,
                text: '0',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            UCLexer.EOF
        ]);
    });

    it('should expand `__FILE__', () => {
        usingDocuments(__dirname, ['PreprocessingTest.uc'], ([testDocument]) => {
            const filePathTokens = textToTokens(testDocument.filePath.replaceAll('\\', '\\\\'));
            assertTokens(`\`__FILE__`, [
                UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
                // Should expand to:
                /* ---- */ ...filePathTokens,

                UCLexer.EOF
            ], testDocument);
        });
    });

    it('should expand `macro #1', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);
        testDocument.macroProvider.setSymbol('macro', { text: 'private' });

        assertTokens(`\`macro\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.KW_PRIVATE,
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },
            UCLexer.NEWLINE,

            UCLexer.EOF
        ], testDocument);

        assertTokens(`\`macro\t`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.KW_PRIVATE,
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },
            UCLexer.WS,

            UCLexer.EOF
        ], testDocument);

        // Validate that the expansion does not leak to the proceding parenthesises.
        assertTokens(`\`macro\tfunction();\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.KW_PRIVATE,
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },
            UCLexer.WS,

            UCLexer.KW_FUNCTION, UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS, UCLexer.SEMICOLON,
            UCLexer.NEWLINE,
            UCLexer.EOF
        ], testDocument);
    });

    it('should expand `macro #2 inlined', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);
        testDocument.macroProvider.setSymbol('macro', { text: 'private' });

        assertTokens(`native(400) static \`macro function Log();\n`, [
            UCLexer.KW_NATIVE, UCLexer.OPEN_PARENS, UCLexer.INTEGER_LITERAL, UCLexer.CLOSE_PARENS, UCLexer.WS,
            UCLexer.KW_STATIC, UCLexer.WS,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.KW_PRIVATE,
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },
            UCLexer.WS,

            UCLexer.KW_FUNCTION, UCLexer.WS,
            UCLexer.ID, UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS, UCLexer.SEMICOLON,
            UCLexer.NEWLINE,

            UCLexer.EOF
        ], testDocument);
    });

    it('should expand `macroInvoke(...arguments)', () => {
        assertTokens(`\`define macroInvoke(arg) \`arg\n\`macroInvoke(argument1)`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS,
            { type: UCLexer.MACRO_DEFINE_SYMBOL, text: 'macroInvoke' },
            UCLexer.OPEN_PARENS,
            { type: UCLexer.MACRO_SYMBOL, text: 'arg' },
            UCLexer.CLOSE_PARENS,
            // UCLexer.WS,
            { type: UCLexer.MACRO_TEXT, text: '\`arg' },
            UCLexer.NEWLINE,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.ID,
                text: 'argument1',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            UCLexer.EOF
        ]);

        // Test multi argument, and concatenate the two
        assertTokens(`\`define macroInvoke(arg,secondArg) \`arg\`secondArg\n\`macroInvoke(argument1,argument2)`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS,
            { type: UCLexer.MACRO_DEFINE_SYMBOL, text: 'macroInvoke' },
            UCLexer.OPEN_PARENS,
            { type: UCLexer.MACRO_SYMBOL, text: 'arg' },
            UCLexer.COMMA,
            { type: UCLexer.MACRO_SYMBOL, text: 'secondArg' },
            UCLexer.CLOSE_PARENS,
            // UCLexer.WS,
            { type: UCLexer.MACRO_TEXT, text: '\`arg\`secondArg' },
            UCLexer.NEWLINE,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            UCLexer.MACRO_SYMBOL,
            UCLexer.COMMA,
            UCLexer.MACRO_SYMBOL,
            UCLexer.CLOSE_PARENS,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.ID,
                text: 'argument1argument2',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            UCLexer.EOF
        ]);

        // Test with preceding NEWLINE
        assertTokens(`\`macroInvoke(\nargument1,\nargument2)`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            UCLexer.NEWLINE,
            UCLexer.MACRO_SYMBOL,
            UCLexer.COMMA,
            UCLexer.NEWLINE,
            UCLexer.MACRO_SYMBOL,
            UCLexer.CLOSE_PARENS,

            UCLexer.EOF
        ]);

        assertTokens(`\`macroInvoke(a \n$ b \n$ c)`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            UCLexer.MACRO_SYMBOL,
            // Ensure the new lines were counted.
            { type: UCLexer.CLOSE_PARENS, line: 3 },

            UCLexer.EOF
        ]);
    });

    // FIXME: Does not work yet (complicated nesting)
    it('should expand nested `macroInvoke(`macro)', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);
        testDocument.macroProvider.setSymbol('logtest', { text: '`text', params: ['text'] });
        testDocument.macroProvider.setSymbol('location', { text: 'macroinvoke' });

        assertTokens(`\`LogTest(\`Location $ "text")`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL, UCLexer.OPEN_PARENS,
            // \`Location $ "text"
            UCLexer.MACRO_SYMBOL,
            UCLexer.CLOSE_PARENS,

            // Should expand to:
            /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            /* ---- */ // Should expand to:
            /* ---- ---- */ UCLexer.ID, UCLexer.WS, UCLexer.DOLLAR, UCLexer.WS, UCLexer.STRING_LITERAL,

            UCLexer.EOF
        ], testDocument);

        assertTokens(`
            \`define combine(a1,a2) \`a1\`a2
            \`define duplicate(a) \`a,\`a
            \`combine(\`duplicate(pa))`, [
            // \`define combine(a1,a2) \`a1\`a2
            UCLexer.NEWLINE, UCLexer.WS, UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS, UCLexer.MACRO_DEFINE_SYMBOL,
            UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.COMMA, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS, UCLexer.MACRO_TEXT,

            // \`define duplicate(a) \`a,\`a
            UCLexer.NEWLINE, UCLexer.WS, UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS, UCLexer.MACRO_DEFINE_SYMBOL,
            UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS, UCLexer.MACRO_TEXT,

            // \`combine(\`duplicate(pa))`
            UCLexer.NEWLINE, UCLexer.WS, UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            UCLexer.MACRO_SYMBOL,
            UCLexer.CLOSE_PARENS,

            /* ---- */ // \`duplicate(pa)
            /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
            /* ---- */ // Should expand to:
            /* ---- ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            /* ---- ---- */ UCLexer.COMMA,
            /* ---- ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            /* ---- ---- ---- */ // Should expand to:
            /* ---- ---- ---- */ { type: UCLexer.ID, text: 'papa' },

            UCLexer.EOF
        ]);
    });

    // Test ambiguous parenthesises.
    it('should lexer ambiguous `macroInvoke(...arguments)', () => {
        assertTokens(`\`macroInvoke()`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            UCLexer.CLOSE_PARENS,

            UCLexer.EOF
        ]);
        assertTokens(`\`macroInvoke((("argument1", "argument2")))`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            { type: UCLexer.MACRO_SYMBOL, text: '(("argument1", "argument2"))' },
            UCLexer.CLOSE_PARENS,

            UCLexer.EOF
        ]);
        assertTokens(`\`macroInvoke(("argument1", "argument2") + 4, arg2)`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            { type: UCLexer.MACRO_SYMBOL, text: '("argument1", "argument2") + 4' },
            UCLexer.COMMA,
            UCLexer.WS,
            { type: UCLexer.MACRO_SYMBOL, text: 'arg2' },
            UCLexer.CLOSE_PARENS,

            UCLexer.EOF
        ]);
        assertTokens(`\`macroInvoke(("\"argument1\",", "(argument2),"), (arg2))`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            UCLexer.OPEN_PARENS,
            { type: UCLexer.MACRO_SYMBOL, text: '("\"argument1\",", "(argument2),")' },
            UCLexer.COMMA,
            UCLexer.WS,
            { type: UCLexer.MACRO_SYMBOL, text: '(arg2)' },
            UCLexer.CLOSE_PARENS,

            UCLexer.EOF
        ]);
    });

    it('should expand `{macro}', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);
        testDocument.macroProvider.setSymbol('macro', { text: 'mysymbol' });

        assertTokens(`\`{macro}`, [
            UCLexer.MACRO_CHAR, UCLexer.OPEN_BRACE, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_BRACE,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.ID,
                text: 'mysymbol',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            UCLexer.EOF
        ], testDocument);


        // FIXME: Lines do not match, perhaps the macro should be expanded inplace.
        assertTokens(`\`{macro\n}`, [
            UCLexer.MACRO_CHAR, UCLexer.OPEN_BRACE,
            UCLexer.MACRO_SYMBOL,
            UCLexer.NEWLINE, UCLexer.CLOSE_BRACE,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.ID,
                text: 'mysymbol',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            UCLexer.EOF
        ], testDocument);
    });

    it('should process `{endif}', () => {
        assertTokens(`\`{endif}`, [
            UCLexer.MACRO_CHAR, UCLexer.OPEN_BRACE, UCLexer.MACRO_END_IF, UCLexer.CLOSE_BRACE,

            UCLexer.EOF
        ]);
    });

    it('should expand `{prefix}Identifier', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);
        testDocument.macroProvider.setSymbol('prefix', { text: 'Concatenated' });

        assertTokens(`function \`{prefix}Identifier myFunction();\n`, [
            UCLexer.KW_FUNCTION, UCLexer.WS,

            UCLexer.MACRO_CHAR, UCLexer.OPEN_BRACE, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_BRACE,
            // Should expand to:
            /* ---- */ {
                type: UCLexer.ID,
                text: 'ConcatenatedIdentifier',
                channel: UCLexer.DEFAULT_TOKEN_CHANNEL
            },

            {
                type: UCLexer.ID,
                text: 'Identifier',
                channel: UCLexer.HIDDEN
            },

            UCLexer.WS, UCLexer.ID, UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS, UCLexer.SEMICOLON,

            UCLexer.NEWLINE,
            UCLexer.EOF
        ], testDocument);
    });

    it('should process `define macro text', () => {
        assertTokens(`\`define func function\n\`func\n\`undefine(func)\n\`func\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS,
            { type: UCLexer.MACRO_DEFINE_SYMBOL, text: 'func' },
            // FIXME: WS is eaten by the macro text mode
            // UCLexer.WS,
            { type: UCLexer.MACRO_TEXT, text: 'function' },
            UCLexer.NEWLINE,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Should expand to:
            /* ---- */ { type: UCLexer.KW_FUNCTION, channel: UCLexer.DEFAULT_TOKEN_CHANNEL },
            UCLexer.NEWLINE,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_UNDEFINE,
            UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
            UCLexer.NEWLINE,

            UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
            // Nothing to expand
            UCLexer.NEWLINE,

            UCLexer.EOF
        ]);
    });

    it('should process `isdefined(macro)', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);

        assertTokens(`\`isdefined(macro)\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_IS_DEFINED,
            UCLexer.OPEN_PARENS, { type: UCLexer.MACRO_SYMBOL, text: 'macro' }, UCLexer.CLOSE_PARENS,
            UCLexer.NEWLINE,

            UCLexer.EOF
        ], testDocument);

        testDocument.macroProvider.setSymbol('macro', { text: 'text' });

        assertTokens(`\`isdefined(macro)\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_IS_DEFINED,
            UCLexer.OPEN_PARENS, { type: UCLexer.MACRO_SYMBOL, text: 'macro' }, UCLexer.CLOSE_PARENS,
            // Should expand to:
            /* ---- */ { type: UCLexer.INTEGER_LITERAL, text: '1' },
            UCLexer.NEWLINE,

            // !! FIXME: Parser stops eating tokens
            // UCLexer.EOF
        ], testDocument);
    });

    it('should process `notdefined(macro)', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);

        assertTokens(`\`notdefined(macro)\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_NOT_DEFINED,
            UCLexer.OPEN_PARENS, { type: UCLexer.MACRO_SYMBOL, text: 'macro' }, UCLexer.CLOSE_PARENS,
            // Should expand to:
            /* ---- */ { type: UCLexer.INTEGER_LITERAL, text: '1' },
            UCLexer.NEWLINE,

            // !! FIXME: Parser stops eating tokens
            // UCLexer.EOF
        ], testDocument);

        testDocument.macroProvider.setSymbol('macro', { text: 'text' });

        assertTokens(`\`notdefined(macro)\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_NOT_DEFINED,
            UCLexer.OPEN_PARENS, { type: UCLexer.MACRO_SYMBOL, text: 'macro' }, UCLexer.CLOSE_PARENS,
            UCLexer.NEWLINE,

            UCLexer.EOF
        ], testDocument);
    });

    it('should process `if(`notdefined(macro))', () => {
        const testDocument = new UCDocument('//transient', TRANSIENT_PACKAGE);
        testDocument.macroProvider = createMacroProvider(testDocument);

        assertTokens(`\`if(\`notdefined(macro))\n`, [
            UCLexer.MACRO_CHAR, UCLexer.MACRO_IF,
            UCLexer.OPEN_PARENS,

            // `notdefined(macro)
            UCLexer.MACRO_CHAR, UCLexer.MACRO_NOT_DEFINED,
            UCLexer.OPEN_PARENS, { type: UCLexer.MACRO_SYMBOL, text: 'macro' }, UCLexer.CLOSE_PARENS,
            // Should expand to:
            /* ---- */ { type: UCLexer.INTEGER_LITERAL, text: '1' },

            UCLexer.CLOSE_PARENS,
            UCLexer.NEWLINE,

            UCLexer.EOF
        ], testDocument);
    });

    it('should expand `include #1', () => {
        usingDocuments(
            __dirname,
            [
                'PreprocessingExpandIncludeTest.uci',
                // Needed for the relative path resolving.
                'PreprocessingIncludeTest.uc'
            ],
            ([, macroIncludeTestDocument]) => {
                assertTokens(`\`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n`, [
                    // \`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // Should expand to:
                    // ---- `define func function
                    /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS,
                    /* ---- */ { type: UCLexer.MACRO_DEFINE_SYMBOL, text: 'func' },
                    /* ---- */ { type: UCLexer.MACRO_TEXT, text: 'function' }, UCLexer.NEWLINE,
                    UCLexer.NEWLINE,

                    UCLexer.EOF
                ], macroIncludeTestDocument);

                // Validate that we can expand the included `define symbol.
                assertTokens(`\`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n\`func\n`, [
                    // \`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // Should expand to:
                    // ---- `define func function
                    /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS,
                    /* ---- */ { type: UCLexer.MACRO_DEFINE_SYMBOL, text: 'func' },
                    /* ---- */ { type: UCLexer.MACRO_TEXT, text: 'function' }, UCLexer.NEWLINE,
                    UCLexer.NEWLINE,

                    // `func\n
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
                    // Should expand to:
                    /* ---- */ { type: UCLexer.KW_FUNCTION },
                    UCLexer.NEWLINE,

                    UCLexer.EOF
                ], macroIncludeTestDocument);
            });
    });

    it('should expand `include #2 with nested `include', () => {
        usingDocuments(
            __dirname,
            [
                'PreprocessingExpandIncludeTest.uci',
                'PreprocessingExpandIncludeDeepTest.uci',
                // Needed for the relative path resolving.
                'PreprocessingIncludeTest.uc'
            ],
            ([, , macroIncludeTestDocument]) => {
                // ´include within the include file?
                // Also mixup some ordinary tokens between the macros to ensure that the token indexes remain in order.
                assertTokens(`class Object;\n\`include(preprocessing\\PreprocessingExpandIncludeDeepTest.uci)\npublic \`func static\n`, [
                    // class Object;\n
                    UCLexer.KW_CLASS, UCLexer.WS, UCLexer.KW_OBJECT, UCLexer.SEMICOLON, UCLexer.NEWLINE,

                    // \`include(preprocessing\\PreprocessingExpandIncludeDeepTest.uci)\n
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // Should expand to:
                    // ---- \`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n
                    /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // ---- Should expand to:
                    // ---- ----- `define func function
                    /* ---- ----- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS, UCLexer.MACRO_DEFINE_SYMBOL, UCLexer.MACRO_TEXT, UCLexer.NEWLINE,
                    /* ---- */ UCLexer.NEWLINE,
                    UCLexer.NEWLINE,

                    // public\s
                    UCLexer.KW_PUBLIC, UCLexer.WS,

                    // `func
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
                    // Should expand to:
                    /* ---- */ UCLexer.KW_FUNCTION,
                    UCLexer.WS,

                    //  static\n
                    UCLexer.KW_STATIC,
                    UCLexer.NEWLINE,

                    UCLexer.EOF
                ], macroIncludeTestDocument);
            });
    });

    it('should expand `include #3 with included UnrealScript', () => {
        usingDocuments(
            __dirname,
            [
                'PreprocessingExpandIncludeTest.uci',
                'PreprocessingExpandIncludeDeepTestWithFunction.uci',
                // Needed for the relative path resolving.
                'PreprocessingIncludeTest.uc'
            ],
            ([, , macroIncludeTestDocument]) => {
                // ´include within the include file? (and contains non-macro tokens after)
                // Also mixup some ordinary tokens between the macros to ensure that the token indexes remain in order.
                assertTokens(`class Object;\n\`include(preprocessing\\PreprocessingExpandIncludeDeepTestWithFunction.uci)\npublic \`func static\n`, [
                    // class Object;\n
                    UCLexer.KW_CLASS, UCLexer.WS, UCLexer.KW_OBJECT, UCLexer.SEMICOLON, UCLexer.NEWLINE,

                    // \`include(preprocessing\\PreprocessingExpandIncludeDeepTest.uci)\n
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // Should expand to:
                    // ---- \`include(preprocessing\\PreprocessingExpandIncludeTest.uci)\n
                    // ---- \n
                    // ---- function test();\n
                    // ---- \n
                    /* ---- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_INCLUDE, UCLexer.OPEN_PARENS, UCLexer.MACRO_SYMBOL, UCLexer.CLOSE_PARENS,
                    // ---- Should expand to:
                    // ---- ----- `define func function
                    /* ---- ----- */ UCLexer.MACRO_CHAR, UCLexer.MACRO_DEFINE, UCLexer.WS, UCLexer.MACRO_DEFINE_SYMBOL, UCLexer.MACRO_TEXT, UCLexer.NEWLINE,
                    /* ---- */ UCLexer.NEWLINE,
                    /* ---- */ UCLexer.NEWLINE,
                    /* ---- */ UCLexer.KW_FUNCTION, UCLexer.WS, UCLexer.ID, UCLexer.OPEN_PARENS, UCLexer.CLOSE_PARENS, UCLexer.SEMICOLON,
                    /* ---- */ UCLexer.NEWLINE,
                    UCLexer.NEWLINE,

                    // public\s
                    UCLexer.KW_PUBLIC, UCLexer.WS,

                    // `func
                    UCLexer.MACRO_CHAR, UCLexer.MACRO_SYMBOL,
                    // Should expand to:
                    /* ---- */ UCLexer.KW_FUNCTION,
                    UCLexer.WS,

                    //  static\n
                    UCLexer.KW_STATIC,
                    UCLexer.NEWLINE,

                    UCLexer.EOF
                ], macroIncludeTestDocument);
            }
        );
    });

    // Not working yet.
    it('should validate PreprocessingGlobals.uci', () => {
        usingDocuments(
            __dirname,
            [
                "Globals.uci",
                "PreprocessingGlobals.uci",
            ],
            ([packageGlobalsDocument, macroGlobalsDocument]) => {
                indexDocument(packageGlobalsDocument);

                const inputStream = UCInputStream.fromString(
                    readTextByURI(macroGlobalsDocument.uri)
                );
                const globalsLexer = new UCLexer(inputStream);
                const globalsMacroProvider = createMacroProvider(macroGlobalsDocument, undefined, packageGlobalsDocument.macroProvider);
                const globalsStream = createTokenStream(globalsLexer, globalsMacroProvider);
                // const globalsMacroParser = (<UCPreprocessorTokenStream>globalsStream).macroParser;

                globalsMacroProvider.setSymbol('debug', { text: 'true' });

                const ucParser = new UCParser(globalsStream);
                const ucProgram = ucParser.program();

                // console.info(globalsStream.getTokens().map(t => getTokenDebugInfo(t, globalsMacroParser)));
                // if (ucProgram.children) for (const ctx of ucProgram.children) {
                //     console.info(ctx.toStringTree(ucParser));
                // }

                // Workspace globals

                expect(globalsMacroProvider.getSymbol("debug"))
                    .to.not.equal(undefined, 'debug !== undefined');

                // Package globals

                expect(globalsMacroProvider.getSymbol("global").text)
                    .to.equal('true', 'global === true');

                // Class symbols

                expect(globalsMacroProvider.getSymbol("classname").text.toLowerCase())
                    .to.equal(
                        path.basename(macroGlobalsDocument.fileName, path.extname(macroGlobalsDocument.fileName)).toLowerCase(),
                        'classname'
                    );

                expect(globalsMacroProvider.getSymbol("packagename").text.toLowerCase())
                    .to.equal(
                        macroGlobalsDocument.classPackage.getName().text.toLowerCase(),
                        'packagename'
                    );

                // Document symbols

                const inDebugSymbol = globalsMacroProvider.getSymbol("debugBool".toLowerCase());
                expect(inDebugSymbol)
                    .to.not.equal(undefined, 'debugBool');

                expect(inDebugSymbol.text)
                    .to.not.equal("false", "debugBool");
            }
        );
    });

    it('should validate PreprocessingIncludeTest.uc', () => {
        usingDocuments(
            __dirname,
            [
                "PreprocessingInclude.uci",
                "PreprocessingIncludeDeep.uci",
                'PreprocessingIncludeTest.uc'
            ],
            ([, , macroIncludeTestDocument]) => {
                queueIndexDocument(macroIncludeTestDocument);

                // Sanity check, all code may possible be 'not included' if the preprocessor eats all the TOKENS.
                assertDocumentFieldSymbol(macroIncludeTestDocument, toName('IncludedFunction'), UCSymbolKind.Function);

                assertDocumentNodes(macroIncludeTestDocument);
                assertDocumentValidFieldsAnalysis(macroIncludeTestDocument, /\bShould(?!BeInvalid)/i);
                assertDocumentInvalidFieldsAnalysis(macroIncludeTestDocument, /\bShouldBeInvalid/i);
            }
        );
    });

    it('should validate PreprocessingTest.uc', () => {
        usingDocuments(
            __dirname,
            [
                "PreprocessingTest.uc",
            ],
            ([macroTestDocument]) => {
                queueIndexDocument(macroTestDocument);

                assertDocumentFieldSymbol(macroTestDocument, toName('ShouldBeValidEnclosedMacroTest'), UCSymbolKind.Function);
                assertDocumentFieldSymbol(macroTestDocument, toName('ShouldBeValidArgumentMacroTest'), UCSymbolKind.Function);

                assertDocumentNodes(macroTestDocument);
                assertDocumentValidFieldsAnalysis(macroTestDocument, /\bShould(?!BeInvalid)/i);
                assertDocumentInvalidFieldsAnalysis(macroTestDocument, /\bShouldBeInvalid/i);
            }
        );
    });
});
