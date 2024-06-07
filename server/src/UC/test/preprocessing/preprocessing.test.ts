import { expect } from "chai";
import { readTextByURI } from "../../../workspace";
import { UCInputStream } from "../../Parser/InputStream";
import { UCLexer } from "../../antlr/generated/UCLexer";
import { createPreprocessor, preprocessDocument } from "../../document";
import { applyMacroSymbols, indexDocument } from "../../indexer";
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
        ([macroDocument, macroTestDocument, macroIncludeDocument, includeTestDocument]) => {
            const inputStream = UCInputStream.fromString(
                readTextByURI(macroDocument.uri)
            );
            const lexer = new UCLexer(inputStream);

            const macroParser = createPreprocessor(macroDocument, lexer);
            expect(macroParser).to.not.be.undefined;

            applyMacroSymbols({ debug: "true" });
            preprocessDocument(macroDocument, macroParser);

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
                preprocessDocument(includeTestDocument, macroParser);

                indexDocument(includeTestDocument);

                expect(includeTestDocument.nodes.length).to.equal(0);
            });
        }
    );
});
