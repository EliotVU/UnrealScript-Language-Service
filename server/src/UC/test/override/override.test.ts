import { expect } from 'chai';

import { getDocumentById, indexDocument } from '../../indexer';
import { toName } from '../../name';
import { UCMethodSymbol, UCStateSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Override', () => {
    usingDocuments(__dirname, ['OverrideTest.uc', 'OverrideBase.uc'], () => {
        const testDocument = getDocumentById(toName('OverrideTest'));
        indexDocument(testDocument);

        const overrideClass = testDocument.class;
        it('MyMethod should override super MyMethod', () => {
            const inheritedSymbol = overrideClass.super.getSymbol<UCMethodSymbol>(toName('MyMethod'));
            expect(inheritedSymbol).to.not.be.undefined;
            const overrideSymbol = overrideClass.getSymbol<UCMethodSymbol>(toName('MyMethod'));
            expect(overrideSymbol.overriddenMethod).to.equal(inheritedSymbol);
            expect(inheritedSymbol).to.not.equal(overrideSymbol);
        });

        it('MyPrivateMethod should not override super MyPrivateMethod?', () => {
            const inheritedSymbol = overrideClass.super.getSymbol<UCMethodSymbol>(toName('MyPrivateMethod'));
            expect(inheritedSymbol).to.not.be.undefined;
            const overrideSymbol = overrideClass.getSymbol<UCMethodSymbol>(toName('MyPrivateMethod'));
            expect(overrideSymbol.overriddenMethod).to.be.undefined;
            expect(inheritedSymbol).to.not.equal(overrideSymbol);
        });

        it('MyState should override super MyState', () => {
            const inheritedSymbol = overrideClass.super.getSymbol<UCStateSymbol>(toName('MyState'));
            expect(inheritedSymbol).to.not.be.undefined;
            const overrideSymbol = overrideClass.getSymbol<UCStateSymbol>(toName('MyState'));
            expect(overrideSymbol.overriddenState).to.equal(inheritedSymbol);
            expect(inheritedSymbol).to.not.equal(overrideSymbol);
        });

        it('MyNewState should not override', () => {
            const symbol = overrideClass.getSymbol<UCStateSymbol>(toName('MyNewState'));
            expect(symbol).to.not.be.undefined;
            expect(symbol.overriddenState).to.be.undefined;
        });
    });
});