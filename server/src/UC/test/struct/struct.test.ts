import { queueIndexDocument } from '../../indexer';
import { assertDocumentAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Struct usage', () => {
    usingDocuments(__dirname, ['StructTest.uc'], ([testDocument]) => {
        it('should have no problems', () => {
            queueIndexDocument(testDocument);
            assertDocumentAnalysis(testDocument).is.equal(0);
        });
    });
});
