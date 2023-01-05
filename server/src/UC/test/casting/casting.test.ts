import { expect } from 'chai';

import { UCCallExpression, UCMemberExpression } from '../../expressions';
import { getDocumentById, queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { UCClassSymbol, UCMethodSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Casting', () => {
    usingDocuments(__dirname, ['CastingTest.uc'], () => {
        const testDocument = getDocumentById(toName('CastingTest'));
        expect(testDocument).to.not.be.undefined;

        queueIndexDocument(testDocument);

        const documentClass = testDocument.class;

        const targetClassSymbol = documentClass.getSymbol<UCClassSymbol>(toName('CastingTest'));
        expect(targetClassSymbol).to.not.be.undefined;

        const targetMethodSymbol = documentClass.getSymbol<UCMethodSymbol>(toName('CastingTest'));
        expect(targetMethodSymbol).to.not.be.undefined;

        it('Usage in Methods', () => {
            const symbol = documentClass.getSymbol<UCMethodSymbol>(toName('Created'));
            expect(symbol, 'symbol').to.not.be.undefined;

            expect(symbol.block.statements[0]).is(typeof(UCCallExpression));
            expect((symbol.block.statements[0] as UCCallExpression).expression).is(typeof(UCMemberExpression));
            expect(((symbol.block.statements[0] as UCCallExpression).expression as UCMemberExpression).type.getRef<UCClassSymbol>()).equal(targetClassSymbol);

            expect(symbol.block.statements[1]).is(typeof(UCCallExpression));
            expect((symbol.block.statements[1] as UCCallExpression).expression).is(typeof(UCMemberExpression));
            expect(((symbol.block.statements[0] as UCCallExpression).expression as UCMemberExpression).type.getRef<UCMethodSymbol>()).equal(targetMethodSymbol);
        });
    });
});