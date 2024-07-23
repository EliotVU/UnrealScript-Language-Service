import { expect } from "chai";
import { readTextByURI } from "../../../workspace";
import { UCInputStream } from "../../Parser/InputStream";
import { UCLexer } from "../../antlr/generated/UCLexer";
import { createPreprocessor, preprocessDocument } from "../../document";
import { applyMacroSymbols, indexDocument, queueIndexDocument } from "../../indexer";
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from "../utils/utils";

describe("Preprocessing", () => {
    usingDocuments(
        __dirname,
        [
            "PreprocessingGlobals.uci",
            "PreprocessingTest.uc",
            "PreprocessingInclude.uci",
            'PreprocessingIncludeTest.uc'
        ],
        ([macroGlobalsDocument, macroTestDocument, macroIncludeDocument, macroIncludeTestDocument]) => {
            const inputStream = UCInputStream.fromString(
                readTextByURI(macroGlobalsDocument.uri)
            );
            const lexer = new UCLexer(inputStream);

            const macroParser = createPreprocessor(macroGlobalsDocument, lexer);
            expect(macroParser).to.not.be.undefined;

            applyMacroSymbols({ debug: "true" });
            preprocessDocument(macroGlobalsDocument, macroParser);

            it("macro debug !== undefined", () => {
                const symbol = macroParser.getSymbolValue(
                    "debug".toLowerCase()
                );
                expect(symbol).to.not.equal(undefined);
            });

            it("macro classname !== undefined", () => {
                const symbol = macroParser.getSymbolValue(
                    "classname".toLowerCase()
                );
                expect(symbol).to.not.equal(undefined);
            });

            it("macro packagename !== undefined", () => {
                const symbol = macroParser.getSymbolValue(
                    "packagename".toLowerCase()
                );
                expect(symbol).to.not.equal(undefined);
            });

            it('macro IN_DEBUG === "true"', () => {
                const symbol = macroParser.getSymbolValue(
                    "IN_DEBUG".toLowerCase()
                );
                expect(symbol).to.not.equal(undefined);

                // FIXME, need to properly format the captured text.
                const cond = symbol.text.trim() === "true";
                expect(cond).to.equal(true);
            });

            // !! Currently not working (this is expecxted)
            it('should include', () => {
                preprocessDocument(macroIncludeTestDocument, macroParser);

                indexDocument(macroIncludeTestDocument);

                expect(macroIncludeTestDocument.nodes.length).to.equal(0);
            });

            it('should have no problems', () => {
                queueIndexDocument(macroTestDocument);

                assertDocumentValidFieldsAnalysis(macroTestDocument, /\bShould(?!BeInvalid)/i);
                assertDocumentInvalidFieldsAnalysis(macroTestDocument, /\bShouldBeInvalid/i);
            })
        }
    );
});
