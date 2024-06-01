import { expect } from 'chai';

import { toName } from '../name';
import { DEFAULT_RANGE, getSymbolHash, SymbolsTable, UCClassSymbol, UCObjectSymbol, UCPackage, UCSymbolKind } from './';

/**
 * Ensure that the ObjectsTable can properly distinguish a package and a class of the same name.
 **/
describe('ObjectsTable', () => {
    const testName = toName('SYMBOL_HASH_COLLISION');
    const globalTable = new SymbolsTable<UCObjectSymbol>();
    const classSymbol = new UCClassSymbol({ name: testName, range: DEFAULT_RANGE }, DEFAULT_RANGE);
    const packageSymbol = new UCPackage(testName);

    const classHash = globalTable.addSymbol(classSymbol);
    const packageHash = globalTable.addSymbol(packageSymbol);

    it('NameHash == SymbolNameHash', () => {
        expect(testName.hash)
            .to.equal(getSymbolHash(classSymbol));
    });

    it('should add/get symbols', () => {
        globalTable.getSymbol(classHash);
        globalTable.getSymbol(packageHash);

        expect(globalTable.getSymbol(classHash, UCSymbolKind.Class))
            .to.equal(classSymbol);
            
        expect(globalTable.getSymbol(packageHash, UCSymbolKind.Package))
            .to.equal(packageSymbol);

        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(2);
    });

    it('should enumerate duplicates', () => {
        const symbols = Array.from(globalTable.enumerateKinds(
            1 << UCSymbolKind.Class |
            1 << UCSymbolKind.Package));

        expect(symbols.length)
            .to.equal(2);

        expect(symbols.includes(classSymbol), 'has enumerated class?')
            .to.be.true;

        expect(symbols.includes(packageSymbol), 'has enumerated package?')
            .to.be.true;
    });

    it('should remove symbols', () => {
        globalTable.removeSymbol(classSymbol);
        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(1);

        globalTable.removeSymbol(packageSymbol);
        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(0);
    });
});
