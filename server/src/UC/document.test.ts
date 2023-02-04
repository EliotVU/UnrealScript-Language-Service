import { expect } from 'chai';
import * as path from 'path';

import { UCLexer } from './antlr/generated/UCLexer';
import { DocumentAnalyzer } from './diagnostics/documentAnalyzer';
import { createPreprocessor, preprocessDocument } from './document';
import { applyMacroSymbols, queueIndexDocument } from './indexer';
import { UCInputStream } from './Parser/InputStream';
import { assertDocument, usingDocuments } from './test/utils/utils';

const GRAMMARS_DIR = path.resolve(__dirname, '../../../grammars/test');

describe('Document', () => {
    const GRAMMARS_DOCUMENTNAME = 'Grammar';
    usingDocuments(GRAMMARS_DIR, [GRAMMARS_DOCUMENTNAME + '.uc'], () => {
        const grammarDocument = assertDocument(GRAMMARS_DOCUMENTNAME);

        // Ensure that the extracted name matches the joined file name.
        it(`fileName === '${GRAMMARS_DOCUMENTNAME}'`, () => {
            expect(grammarDocument.fileName).to.equal(GRAMMARS_DOCUMENTNAME);
        });

        it('Index', () => {
            queueIndexDocument(grammarDocument);
            expect(grammarDocument.hasBeenIndexed).to.be.true;
        });

        it('Diagnostics free?', () => {
            const diagnoser = new DocumentAnalyzer(grammarDocument);
            const diagnostics = diagnoser.visitDocument(grammarDocument);
            const msg = diagnostics.toDiagnostic()
                .map(d => d.message)
                .join(';');
            expect(diagnostics.count(), msg).is.equal(0);
        });
    });
});

describe('Document with macros', () => {
    const MACRO_FILENAME = 'macro.uci';
    usingDocuments(GRAMMARS_DIR, [MACRO_FILENAME], () => {
        const macroDocument = assertDocument(MACRO_FILENAME);

        const inputStream = UCInputStream.fromString(macroDocument.readText());
        const lexer = new UCLexer(inputStream);

        const macroParser = createPreprocessor(macroDocument, lexer);
        if (macroParser) {
            applyMacroSymbols({ "debug": "" });
            preprocessDocument(macroDocument, macroParser);

            it('macro debug !== undefined', () => {
                const symbol = macroParser.getSymbolValue('debug'.toLowerCase());
                expect(symbol).to.not.equal(undefined);
            });

            it('macro classname !== undefined', () => {
                const symbol = macroParser.getSymbolValue('classname'.toLowerCase());
                expect(symbol).to.not.equal(undefined);
            });

            it('macro packagename !== undefined', () => {
                const symbol = macroParser.getSymbolValue('packagename'.toLowerCase());
                expect(symbol).to.not.equal(undefined);
            });

            it('macro IN_DEBUG === "true"', () => {
                const symbol = macroParser.getSymbolValue('IN_DEBUG'.toLowerCase());
                expect(symbol).to.not.equal(undefined);
                // FIXME, need to properly format the captured text.
                const cond = symbol && symbol.text === ' true\r';
                expect(cond).to.equal(true);
            });
        } else {
            // ??? no macros in macro.uci
        }
    });
});