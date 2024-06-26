import { queueIndexDocument } from '../../indexer';
import { assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('ScriptStructSymbol usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['StructTest.uc'], ([testDocument]) => {
            queueIndexDocument(testDocument);

            assertDocumentValidFieldsAnalysis(testDocument, /\bShould(?!BeInvalid)/i);
        });
    });
});
