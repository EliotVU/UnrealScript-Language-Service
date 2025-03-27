import { expect } from 'chai';

import {
    UCEnumMemberSymbol,
    UCEnumSymbol,
} from '../../Symbols';
import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { NAME_ENUMCOUNT } from '../../names';
import { assertDocumentValidFieldsAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';

describe('EnumSymbol usage', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['EnumTest.uc', 'EnumWithinClass.uc', 'EnumDependencyClass.uc'], ([testDocument]) => {
            queueIndexDocument(testDocument);
            const documentClass = testDocument.class;

            const enumTestSymbol = documentClass.getSymbol<UCEnumSymbol>(toName('EEnumTest'));
            expect(enumTestSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT))
                .to.not.be.undefined;
            expect(enumTestSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT).value)
                .to.equal(3);

            assertDocumentValidFieldsAnalysis(testDocument, /\bShould(?!BeInvalid)/i);
            // assertDocumentInvalidFieldsAnalysis(testDocument, /\bInvalid/);
            // assertDocumentValidSymbolAnalysis(testDocument, testDocument.class!.getSymbol(NAME_DEFAULTPROPERTIES));
        });
    });
});
