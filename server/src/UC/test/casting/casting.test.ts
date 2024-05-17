import { queueIndexDocument } from '../../indexer';
import { usingDocuments } from '../utils/utils';
import { assertDocumentValidFieldsAnalysis, assertDocumentInvalidFieldsAnalysis, assertDocumentValidSymbolAnalysis } from '../utils/diagnosticUtils';
import { toName } from '../../name';

describe('Casting', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['../interface/InterfaceTest.uc', 'CastingTest.uc', 'CastingDerivative.uc'], ([, castingTestDocument]) => {
            queueIndexDocument(castingTestDocument);
            assertDocumentValidFieldsAnalysis(castingTestDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(castingTestDocument, /\bShouldBeInvalid/i);

            assertDocumentValidSymbolAnalysis(castingTestDocument, castingTestDocument.class!.getSymbol(toName('defaultproperties')));
        });
    });
});
