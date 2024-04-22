import { queueIndexDocument } from '../../indexer';
import { assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Struct usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['StructTest.uc'], ([testDocument]) => {
            queueIndexDocument(testDocument);
            assertDocumentValidFieldsAnalysis(testDocument);
        });
    });
});
