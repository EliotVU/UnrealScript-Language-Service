import { expect } from 'chai';

import { toName } from '../name';
import { NAME_CLASS, NAME_PACKAGE } from '../names';
import { DEFAULT_RANGE, getOuter, StaticNoneType, UCClassSymbol, UCPackage, UCPropertySymbol, UCSymbolKind } from './';

describe('Test ISymbol utilities', () => {
    const packageSymbol = new UCPackage(NAME_PACKAGE);

    const classSymbol = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
    classSymbol.outer = packageSymbol;

    const propertySymbol = new UCPropertySymbol({
        name: toName('MyProperty'),
        range: DEFAULT_RANGE
    }, DEFAULT_RANGE, StaticNoneType);
    classSymbol.addSymbol(propertySymbol);

    it('getOuter()', () => {
        expect(getOuter(propertySymbol, UCSymbolKind.Class))
            .to.equal(classSymbol);
        expect(getOuter(propertySymbol, UCSymbolKind.Package))
            .to.equal(packageSymbol);
    });
});
