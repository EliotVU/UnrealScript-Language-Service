import { indexDocument } from '../../indexer';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('Parsing', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['ParsingTest.uc'], ([testDocument]) => {
            indexDocument(testDocument);

            assertDocumentValidFieldsAnalysis(testDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(testDocument, /\bInvalid/);
        });
    });
});
