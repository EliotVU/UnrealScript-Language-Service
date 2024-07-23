import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { assertDocumentInvalidFieldsAnalysis, assertDocumentValidFieldsAnalysis, assertDocumentValidSymbolAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('DelegateSymbol usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['DelegateTest.uc'], ([delegateTestDocument]) => {
            queueIndexDocument(delegateTestDocument);

            assertDocumentValidFieldsAnalysis(delegateTestDocument, /\bShould(?!BeInvalid)/i);
            assertDocumentInvalidFieldsAnalysis(delegateTestDocument, /\bShouldBeInvalid/i);

            assertDocumentValidSymbolAnalysis(
                delegateTestDocument,
                delegateTestDocument.class!.getSymbol(
                    toName("defaultproperties")
                )
            );
        });
    });
});
