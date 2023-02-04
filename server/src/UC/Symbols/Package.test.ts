import { expect } from 'chai';

import { toName } from '../name';
import {
    addHashedSymbol,
    DEFAULT_RANGE,
    getSymbolHash,
    ObjectsTable,
    removeHashedSymbol,
    UCClassSymbol,
    UCPackage,
    UCSymbolKind,
} from './';

/**
 * Ensure that the ObjectsTable can properly distinguish a package and a class of the same name.
 **/
describe('Test ObjectsTable\'s state', () => {
    const testName = toName('SYMBOL_HASH_COLLISION');
    const classSymbol = new UCClassSymbol({ name: testName, range: DEFAULT_RANGE });
    const packageSymbol = new UCPackage(testName);

    it('NameHash == SymbolNameHash', () => {
        expect(testName.hash)
            .to.equal(getSymbolHash(classSymbol));
    });

    it('Adding', () => {
        const initialCount = ObjectsTable.count();
        const classHash = addHashedSymbol(classSymbol);
        const packageHash = addHashedSymbol(packageSymbol);
        expect(classHash)
            .to.equal(packageHash);

        // class and package are expected to be linked and thus count as 1 addition.
        expect(ObjectsTable.count())
            .to.equal(initialCount + 1);
    });

    it('hash lookup', () => {
        const lookupHash = testName.hash;
        const classSymbolGet = ObjectsTable.getSymbol<UCClassSymbol>(lookupHash, UCSymbolKind.Class);
        expect(typeof classSymbolGet, 'Is class defined?')
            .to.not.equal('undefined');

        const packageSymbolGet = ObjectsTable.getSymbol<UCPackage>(lookupHash, UCSymbolKind.Package);
        expect(typeof packageSymbolGet, 'is package defined?')
            .to.not.equal('undefined');
    });

    it('Removing', () => {
        const initialCount = ObjectsTable.count();

        removeHashedSymbol(classSymbol);
        expect(ObjectsTable.count())
            .to.equal(initialCount);

        removeHashedSymbol(packageSymbol);
        expect(ObjectsTable.count())
            .to.equal(initialCount - 1);
    });
});
