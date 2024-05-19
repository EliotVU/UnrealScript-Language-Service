import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis, assertDocumentValidSymbolAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

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
