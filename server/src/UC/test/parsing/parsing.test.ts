import { expect } from 'chai';
import { indexDocument } from '../../indexer';
import { usingDocuments } from '../utils/utils';

describe('Parsing', () => {
    it('should have no problems', () => {
        usingDocuments(__dirname, ['ParsingTest.uc'], ([testDocument]) => {
            indexDocument(testDocument);
            expect(testDocument.nodes.length).to.equal(0, testDocument.nodes.map(n => n.toString()).join('\n'));
        });
    });
});
