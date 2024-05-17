import { queueIndexDocument } from '../../indexer';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Array usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['ArrayTest.uc'], ([testDocument]) => {
            queueIndexDocument(testDocument);
            assertDocumentValidFieldsAnalysis(testDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(testDocument, /\bInvalid/);
        });
    });
});
