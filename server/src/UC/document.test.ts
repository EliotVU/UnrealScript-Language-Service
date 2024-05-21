import { expect } from 'chai';
import { TRANSIENT_PACKAGE } from './Symbols';
import { UCDocument } from './document';
import { toName } from './name';

describe('Document', () => {
    // Ensure that the extracted name matches the joined file name.
    it(`pathing`, () => {
        const document = new UCDocument('PseudoFolder/PseudoDocument.UC', TRANSIENT_PACKAGE);
        expect(document.fileName).to.equal('PseudoDocument.UC');
        expect(document.name).to.equal(toName('pseudodocument'));
        expect(document.uri).to.equal('file:///PseudoFolder/PseudoDocument.UC');
    });
});
