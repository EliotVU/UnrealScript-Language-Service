import { expect } from 'chai';
import * as path from 'path';

import { UCLexer } from './antlr/generated/UCLexer';
import { DocumentAnalyzer } from './diagnostics/documentAnalyzer';
import { createPreprocessor, preprocessDocument } from './document';
import { applyMacroSymbols, getDocumentById, queueIndexDocument } from './indexer';
import { toName } from './name';
import { UCInputStream } from './Parser/InputStream';
import { usingDocuments } from './test/utils/utils';

const GRAMMARS_RELATIVE_DIR = path.resolve(__dirname, '../../../grammars/examples');
const MACRO_FILE = 'macro.uci';

describe('Document', () => {
    usingDocuments(GRAMMARS_RELATIVE_DIR, [MACRO_FILE], () => {
        const macroDocument = getDocumentById(toName(MACRO_FILE))!;
        expect(macroDocument).to.not.be.undefined;

        // Ensure that the extracted name matches the joined file name.
        it(`fileName === '${MACRO_FILE}'`, () => {
            expect(macroDocument.fileName).to.equal(MACRO_FILE);
        });

        it('Index', () => {
            queueIndexDocument(macroDocument);
            expect(macroDocument.hasBeenIndexed).to.be.true;
        });

        it('Diagnostics free?', () => {
            const diagnoser = new DocumentAnalyzer(macroDocument);
            const diagnostics = diagnoser.visitDocument(macroDocument);
            expect(diagnostics.count()).to.be.null;
        });
    });
});

describe('Document with macros', () => {
    usingDocuments(GRAMMARS_RELATIVE_DIR, [MACRO_FILE], () => {
        const macroDocument = getDocumentById(toName(MACRO_FILE))!;
        expect(macroDocument).to.not.be.undefined;

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