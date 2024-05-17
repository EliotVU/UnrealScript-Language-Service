import { queueIndexDocument } from "../../indexer";
import { usingDocuments } from "../utils/utils";
import { assertDocumentValidSymbolAnalysis } from "../utils/diagnosticUtils";

describe("Archetype", () => {
    it("should have no problems", () => {
        usingDocuments(
            __dirname,
            [
                "ArchetypeTemplate.uc",
                "ArchetypeTest.uc",
                "ArchetypeOverrideTest.uc",
            ],
            ([
                archetypeTemplateDoc,
                archetypeTestDoc,
                archetypeOverrideTestDoc,
            ]) => {
                queueIndexDocument(archetypeOverrideTestDoc);

                assertDocumentValidSymbolAnalysis(
                    archetypeTemplateDoc,
                    archetypeTemplateDoc.class
                );
                assertDocumentValidSymbolAnalysis(
                    archetypeTestDoc,
                    archetypeTestDoc.class
                );
                assertDocumentValidSymbolAnalysis(
                    archetypeOverrideTestDoc,
                    archetypeOverrideTestDoc.class
                );
            }
        );
    });
});
