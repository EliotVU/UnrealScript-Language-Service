import { expect } from 'chai';

import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { UCExpressionStatement } from '../../statements';
import { UCMethodSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Casting', () => {
    usingDocuments(__dirname, ['CastingTest.uc'], ([testDocument]) => {
        queueIndexDocument(testDocument);

        const documentClass = testDocument.class;
        const targetMethodSymbol = documentClass.getSymbol<UCMethodSymbol>(toName('CastingTest'));
        
        it('Usage in Methods', () => {
            expect(targetMethodSymbol)
                .to.not.be.undefined;
                
            const symbol = documentClass.getSymbol<UCMethodSymbol>(toName('Created'));
            expect(symbol, 'symbol')
                .to.not.be.undefined;

            {
                const stm = symbol.block.statements[0] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(documentClass);
            }
            {
                const stm = symbol.block.statements[1] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(targetMethodSymbol);
            }
            // FIXME: Not yet supported
            {
                const stm = symbol.block.statements[2] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(targetMethodSymbol);
            }
        });
    });
});