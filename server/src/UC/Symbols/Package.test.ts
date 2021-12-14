import { expect } from 'chai';

import { toName } from '../name';
import { DEFAULT_RANGE, UCClassSymbol, UCTypeFlags } from './';
import {
    addHashedSymbol, getSymbolHash, ObjectsTable, removeHashedSymbol, UCPackage
} from './Package';

/**
 * Ensure that the ObjectsTable can properly distinguish a package and a class of the same name.
 **/
describe('Test ObjectsTable\'s state', () => {
    const defaultCount = ObjectsTable.count();

    const testName = toName('SYMBOL_HASH_COLLISION');
    const classSymbol = new UCClassSymbol({ name: testName, range: DEFAULT_RANGE });
    const packageSymbol = new UCPackage(testName);

    it('NameHash == SymbolNameHash', () => {
        expect(testName.hash)
            .to.equal(getSymbolHash(classSymbol));
    });

    it('Adding', () => {
        const classHash = addHashedSymbol(classSymbol);
        const packageHash = addHashedSymbol(packageSymbol);
        expect(classHash)
            .to.equal(packageHash);

        // class and package are expected to be linked and thus count as 1 addition.
        expect(ObjectsTable.count())
            .to.equal(defaultCount + 1);
    });

    it('hash lookup', () => {
        const lookupHash = testName.hash;
        const classSymbolGet = ObjectsTable.getSymbol<UCClassSymbol>(lookupHash, UCTypeFlags.Class);
        expect(typeof classSymbolGet, 'Is class defined?')
            .to.not.equal('undefined');

        const packageSymbolGet = ObjectsTable.getSymbol<UCPackage>(lookupHash, UCTypeFlags.Package);
        expect(typeof packageSymbolGet, 'is package defined?')
            .to.not.equal('undefined');
    });

    it('Removing', () => {
        removeHashedSymbol(classSymbol);
        expect(ObjectsTable.count())
            .to.equal(defaultCount + 1);

        removeHashedSymbol(packageSymbol);
        expect(ObjectsTable.count())
            .to.equal(defaultCount);
    });
});
