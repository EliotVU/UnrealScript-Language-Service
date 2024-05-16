import { queueIndexDocument } from '../../indexer';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Array usage', () => {
    usingDocuments(__dirname, ['ArrayTest.uc'], ([testDocument]) => {
        queueIndexDocument(testDocument);

        it('should have no problems', () => {
            queueIndexDocument(testDocument);
            assertDocumentValidFieldsAnalysis(testDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(testDocument, /\bInvalid/);
        });
    });
});
