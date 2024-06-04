import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis, assertDocumentValidSymbolAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Casting', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, [
            'CastingTest.uc',
            'CastingDerivative.uc',
            'CastingActor.uc',
            '../interface/InterfaceTest.uc',
            '../UnrealScriptTests/Engine/Classes/Actor.uc',
        ], ([castingTestDocument]) => {
            queueIndexDocument(castingTestDocument);
            assertDocumentValidFieldsAnalysis(castingTestDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(castingTestDocument, /\bShouldBeInvalid/i);

            assertDocumentValidSymbolAnalysis(castingTestDocument, castingTestDocument.class!.getSymbol(toName('defaultproperties')));
        });
    });
});
