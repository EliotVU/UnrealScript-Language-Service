import { queueIndexDocument } from "../../indexer";
import {
    assertDocumentInvalidFieldsAnalysis,
    assertDocumentValidFieldsAnalysis,
} from "../utils/diagnosticUtils";
import { usingDocuments } from "../utils/utils";

describe("ClassSymbol usage", () => {
    it("should have no problems", () => {
        usingDocuments(
            __dirname,
            [
                "MyBaseClass.uc",
                "MyExtendedWithinClassTest.uc",
                "MyWithinClass.uc",
            ],
            ([_, MyExtendedWithinClassTest]) => {
                queueIndexDocument(MyExtendedWithinClassTest);
                assertDocumentValidFieldsAnalysis(
                    MyExtendedWithinClassTest,
                    /\bShould(?!BeInvalid)/i
                );
                assertDocumentInvalidFieldsAnalysis(
                    MyExtendedWithinClassTest,
                    /\bShouldBeInvalid/i
                );
            }
        );
    });
});
