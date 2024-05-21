import { queueIndexDocument } from '../../indexer';
import { usingDocuments } from '../utils/utils';
import { assertDocumentValidFieldsAnalysis, assertDocumentInvalidFieldsAnalysis } from '../utils/diagnosticUtils';

describe('DelegateSymbol usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['DelegateTest.uc'], ([delegateTestDocument]) => {
            queueIndexDocument(delegateTestDocument);

            assertDocumentValidFieldsAnalysis(delegateTestDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(delegateTestDocument, /\bShouldBeInvalid/i);
        });
    });
});
