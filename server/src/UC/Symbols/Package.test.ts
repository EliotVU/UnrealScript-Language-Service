import { expect } from 'chai';

import { toName } from '../name';
import { DEFAULT_RANGE, getSymbolHash, getSymbolOuterHash, SymbolsTable, UCClassSymbol, UCObjectSymbol, UCPackage, UCSymbolKind } from './';

/**
 * Ensure that the ObjectsTable can properly distinguish a package and a class of the same name.
 *
 * We do not use the Objects or OuterObjects table here (or any global state for that matter),
 * because Unit-tests may be run in parrallel.
 **/
describe('ObjectsTable', () => {
    const testName = toName('SYMBOL_HASH_COLLISION');
    const globalTable = new SymbolsTable<UCObjectSymbol>();
    const packageSymbol = new UCPackage(testName);
    const classSymbol = new UCClassSymbol({ name: testName, range: DEFAULT_RANGE }, DEFAULT_RANGE);
    classSymbol.outer = packageSymbol;

    const classHash = globalTable.addSymbol(classSymbol);
    const packageHash = globalTable.addSymbol(packageSymbol);
    const classPackageHash = getSymbolOuterHash(classHash, packageHash);

    // Emulate OuterObjectsTable for outer-based lookups
    globalTable.addKey(classPackageHash, classSymbol);

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

        expect(globalTable.getSymbol(classPackageHash, UCSymbolKind.Class))
            .to.equal(classSymbol);

        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(3);
    });

    it('should enumerate duplicates', () => {
        const symbols = Array.from(globalTable.enumerateKinds(
            1 << UCSymbolKind.Class |
            1 << UCSymbolKind.Package));

        expect(symbols.length)
            .to.equal(3);

        expect(symbols.includes(classSymbol), 'has enumerated class?')
            .to.be.true;

        expect(symbols.includes(packageSymbol), 'has enumerated package?')
            .to.be.true;
    });

    it('should remove symbols', () => {
        globalTable.removeSymbol(classSymbol);
        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(2);

        globalTable.removeSymbol(packageSymbol);
        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(1);

        globalTable.removeKey(classPackageHash, classSymbol);

        globalTable.removeSymbol(packageSymbol);
        expect(Array.from(globalTable.enumerateAll()).length)
            .to.equal(0);
    });
});
