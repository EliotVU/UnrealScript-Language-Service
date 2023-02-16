import { expect } from 'chai';

import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { queueIndexDocument } from '../../indexer';
import { addHashedSymbol, IntrinsicObject, removeHashedSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Struct usage', () => {
    usingDocuments(__dirname, ['StructTest.uc'], ([testDocument]) => {
        addHashedSymbol(IntrinsicObject);
        queueIndexDocument(testDocument);
        removeHashedSymbol(IntrinsicObject);

        const documentClass = testDocument.class;

        it('should have no problems', () => {
            const diagnoser = new DocumentAnalyzer(testDocument);
            documentClass.accept(diagnoser);
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(0);
        });
    });
});
