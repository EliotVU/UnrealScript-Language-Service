import { expect } from 'chai';

import {
    UCAssignmentOperatorExpression,
    UCDefaultAssignmentExpression,
    UCDefaultElementAccessExpression,
    UCObjectLiteral,
} from '../../expressions';
import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { NAME_ENUMCOUNT } from '../../names';
import { UCExpressionStatement, UCSwitchStatement } from '../../statements';
import {
    IntrinsicEnum,
    UCDefaultPropertiesBlock,
    UCEnumMemberSymbol,
    UCMethodSymbol,
    UCPropertySymbol,
    UCSymbolKind,
} from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Enum', () => {
    usingDocuments(__dirname, ['EnumTest.uc'], ([testDocument]) => {
        queueIndexDocument(testDocument);

        const documentClass = testDocument.class;
        const enumTestSymbol = documentClass.getSymbol<UCMethodSymbol>(toName('EEnumTest'));
        expect(enumTestSymbol)
            .to.not.be.undefined;

        it('Enum EEnumTest is declared', () => {
            expect(enumTestSymbol)
                .to.not.be.undefined;
            expect(enumTestSymbol.getSymbol(toName('ET_None')))
                .to.not.be.undefined;
            expect(enumTestSymbol.getSymbol(toName('ET_Other')))
                .to.not.be.undefined;
        });

        it('Intrinsic EnumCount', () => {
            expect(enumTestSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT))
                .to.not.be.undefined;
            expect(enumTestSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT).value)
                .to.equal(2);
        });

        // Not yet globally indexed
        // TODO: Implement globally to enable support for Enum'EEnumTest';
        // it('Enum EEnumTest is indexed', () => {
        //     const globalSymbol = ObjectsTable.getSymbol<UCEnumSymbol>(toName('EEnumTest'), UCTypeFlags.Enum);
        //     expect(globalSymbol).to.not.be.undefined;
        // });

        it('Usage in Properties', () => {
            expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyEnumProperty'))
                .getType().getRef())
                .to.equal(enumTestSymbol);
            expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyEnumBasedDimProperty'))
                .arrayDimRef.getRef())
                .to.equal(enumTestSymbol);
            // TODO: Support
            // expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyQualifiedEnumBasedDimProperty')).arrayDimRef.getRef().outer).to.equal(enumSymbol);
        });

        it('Usage in Methods', () => {
            const symbol = documentClass.getSymbol<UCMethodSymbol>(toName('EnumTestMethod'));
            expect(symbol, 'symbol')
                .to.not.be.undefined;

            expect(symbol.returnValue.getType().getRef())
                .to.equal(enumTestSymbol);
            for (const param of symbol.params) {
                expect(param.getType().getRef())
                    .to.equal(enumTestSymbol);
                expect(param.defaultExpression.getType().getRef().outer)
                    .to.equal(enumTestSymbol);
            }

            expect(symbol.block, 'method block')
                .to.not.be.undefined;
            for (const stm of symbol.block.statements) {
                if (stm instanceof UCSwitchStatement) {
                    const expr = stm.expression;
                    expect(expr.getType().getRef())
                        .to.equal(enumTestSymbol);
                    for (const stm2 of stm.then.statements) {
                        if (stm2 instanceof UCExpressionStatement) {
                            expect(stm2.expression.getType().getRef().outer)
                                .to.equal(enumTestSymbol);
                        }
                    }
                } else if (stm instanceof UCExpressionStatement) {
                    const expr = stm.expression;
                    if (expr instanceof UCAssignmentOperatorExpression) {
                        expect(expr.left.getType().getRef())
                            .to.equal(enumTestSymbol);
                        expect(expr.right.getType().getRef().outer)
                            .to.equal(enumTestSymbol);
                    } else if (expr instanceof UCObjectLiteral) {
                        expect(expr.castRef.getRef(), 'castRef')
                            .to.equal(IntrinsicEnum, 'enum class');
                        expect(expr.objectRef.getRef(), 'objectRef')
                            .to.equal(enumTestSymbol, 'enum object');
                    } else {
                        expect(stm.expression.getType().getRef().outer)
                            .to.equal(enumTestSymbol, 'enum object');
                    }
                }
            }
        });

        it('Usage in DefaultProperties', () => {
            const symbol = documentClass.getSymbol<UCDefaultPropertiesBlock>(
                toName('Default'),
                UCSymbolKind.DefaultPropertiesBlock);
            expect(symbol, 'symbol')
                .to.not.be.undefined;
            expect(symbol.block, 'symbol block')
                .to.not.be.undefined;

            // MyEnumProperty=ET_None
            {
                const stm = symbol.block.statements[0] as UCDefaultAssignmentExpression;
                expect(stm.left.getType().getRef(), 'MyEnumProperty')
                    .to.equal(enumTestSymbol);
                expect(stm.right.getType().getRef().outer, 'ET_None')
                    .to.equal(enumTestSymbol);
            }
            // MyEnumBasedDimProperty(ET_None)=ET_None
            {
                const stm = symbol.block.statements[1] as UCDefaultElementAccessExpression;
                expect(stm.expression.getType().getRef(), 'MyEnumBasedDimProperty')
                    .to.equal(enumTestSymbol);
                expect(stm.argument.getType().getRef().outer, '(ET_None)')
                    .to.equal(enumTestSymbol);
            }
        });
    });
});