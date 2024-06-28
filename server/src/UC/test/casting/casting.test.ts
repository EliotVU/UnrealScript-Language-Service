import { expect } from "chai";
import {
    DEFAULT_RANGE,
    IntrinsicClass,
    IntrinsicObject,
    TypeMatchFlags,
    TypeMatchReport,
    UCObjectTypeSymbol,
    typesMatch,
} from "../../Symbols";
import { queueIndexDocument } from "../../indexer";
import { toName } from "../../name";
import {
    assertDocumentInvalidFieldsAnalysis,
    assertDocumentValidFieldsAnalysis,
    assertDocumentValidSymbolAnalysis,
} from "../utils/diagnosticUtils";
import { usingDocuments } from "../utils/utils";

describe("Casting", () => {
    it("should have no problems", () => {
        usingDocuments(
            __dirname,
            [
                "CastingTest.uc",
                "CastingDerivative.uc",
                "CastingActor.uc",
                "../interface/InterfaceTest.uc",
                "../UnrealScriptTests/Engine/Classes/Actor.uc",
            ],
            ([castingTestDocument, CastingDerivativeDocument]) => {
                queueIndexDocument(castingTestDocument);
                assertDocumentValidFieldsAnalysis(
                    castingTestDocument,
                    /\bShould(?!BeInvalid)/i
                );
                assertDocumentInvalidFieldsAnalysis(
                    castingTestDocument,
                    /\bShouldBeInvalid/i
                );

                assertDocumentValidSymbolAnalysis(
                    castingTestDocument,
                    castingTestDocument.class!.getSymbol(
                        toName("defaultproperties")
                    )
                );

                // let's hand test some class matching.

                // == Let's verify that we cannot pass a `Class'Class'` to a param of type `Class<CastingDerivative>`

                const intrinsicClassType = new UCObjectTypeSymbol({
                    name: IntrinsicClass.getName(),
                    range: DEFAULT_RANGE,
                });
                intrinsicClassType.setRefNoIndex(IntrinsicClass);

                // Replicate Class'Class' / Class<Class>
                const ClassArgumentType = new UCObjectTypeSymbol({
                    name: IntrinsicClass.getName(),
                    range: DEFAULT_RANGE,
                });
                ClassArgumentType.setRefNoIndex(IntrinsicClass);
                ClassArgumentType.baseType = intrinsicClassType;

                const derivateClass = CastingDerivativeDocument.class!;

                const derivativeClassType = new UCObjectTypeSymbol({
                    name: derivateClass.getName(),
                    range: DEFAULT_RANGE,
                });
                derivativeClassType.setRefNoIndex(derivateClass);

                // Replicate Class<CastingDerivative>
                const ClassParamType = new UCObjectTypeSymbol({
                    name: IntrinsicClass.getName(),
                    range: DEFAULT_RANGE,
                });
                ClassParamType.setRefNoIndex(IntrinsicClass);
                ClassParamType.baseType = derivativeClassType;

                const intrinsicObjectType = new UCObjectTypeSymbol({
                    name: IntrinsicObject.getName(),
                    range: DEFAULT_RANGE,
                });
                intrinsicObjectType.setRefNoIndex(IntrinsicObject);

                expect(
                    typesMatch(
                        ClassArgumentType,
                        ClassParamType,
                        TypeMatchFlags.None
                    ))
                    .is.equals(TypeMatchReport.MetaClassMismatch);

                expect(
                    typesMatch(
                        ClassArgumentType,
                        ClassParamType,
                        TypeMatchFlags.None
                    ) > 0)
                    .is.false;
            }
        );
    });
});
