import { expect } from 'chai';

import {
    UCAssignmentOperatorExpression, UCDefaultAssignmentExpression, UCDefaultElementAccessExpression,
    UCObjectLiteral
} from '../../expressions';
import { getDocumentById, queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { NAME_ENUMCOUNT } from '../../names';
import { UCExpressionStatement, UCSwitchStatement } from '../../statements';
import {
    IntrinsicEnum, UCDefaultPropertiesBlock, UCEnumMemberSymbol, UCMethodSymbol, UCPropertySymbol
} from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Enum', () => {
    usingDocuments(__dirname, ['EnumTest.uc'], () => {
        const testDocument = getDocumentById(toName('EnumTest'));
        expect(testDocument).to.not.be.undefined;

        queueIndexDocument(testDocument);

        const documentClass = testDocument.class;
        const enumSymbol = documentClass.getSymbol<UCMethodSymbol>(toName('EEnumTest'));
        expect(enumSymbol).to.not.be.undefined;

        it('Enum EEnumTest is declared', () => {
            expect(enumSymbol).to.not.be.undefined;
            expect(enumSymbol.getSymbol(toName('ET_None'))).to.not.be.undefined;
            expect(enumSymbol.getSymbol(toName('ET_Other'))).to.not.be.undefined;
        });

        it('Intrinsic EnumCount', () => {
            expect(enumSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT)).to.not.be.undefined;
            expect(enumSymbol.getSymbol<UCEnumMemberSymbol>(NAME_ENUMCOUNT).value).to.equal(2);
        });

        // Not yet globally indexed
        // TODO: Implement globally to enable support for Enum'EEnumTest';
        // it('Enum EEnumTest is indexed', () => {
        //     const globalSymbol = ObjectsTable.getSymbol<UCEnumSymbol>(toName('EEnumTest'), UCTypeFlags.Enum);
        //     expect(globalSymbol).to.not.be.undefined;
        // });

        it('Usage in Properties', () => {
            expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyEnumProperty')).getType().getRef()).to.equal(enumSymbol);
            expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyEnumBasedDimProperty')).arrayDimRef.getRef()).to.equal(enumSymbol);
            // TODO: Support
            // expect(documentClass.getSymbol<UCPropertySymbol>(toName('MyQualifiedEnumBasedDimProperty')).arrayDimRef.getRef().outer).to.equal(enumSymbol);
        });

        it('Usage in Methods', () => {
            const symbol = documentClass.getSymbol<UCMethodSymbol>(toName('EnumTestMethod'));
            expect(symbol, 'symbol').to.not.be.undefined;

            expect(symbol.returnValue.getType().getRef()).to.equal(enumSymbol);
            for (const param of symbol.params) {
                expect(param.getType().getRef()).to.equal(enumSymbol);
                expect(param.defaultExpression.getType().getRef().outer).to.equal(enumSymbol);
            }

            expect(symbol.block, 'method block').to.not.be.undefined;
            for (const stm of symbol.block.statements) {
                if (stm instanceof UCSwitchStatement) {
                    const expr = stm.expression;
                    expect(expr.getType().getRef()).to.equal(enumSymbol);
                    for (const stm2 of stm.then.statements) {
                        if (stm2 instanceof UCExpressionStatement) {
                            expect(stm2.expression.getType().getRef().outer).to.equal(enumSymbol);
                        }
                    }
                } else if (stm instanceof UCExpressionStatement) {
                    const expr = stm.expression;
                    if (expr instanceof UCAssignmentOperatorExpression) {
                        expect(expr.left.getType().getRef()).to.equal(enumSymbol);
                        expect(expr.right.getType().getRef().outer).to.equal(enumSymbol);
                    } else if (expr instanceof UCObjectLiteral) {
                        expect(expr.castRef.getRef(), 'castRef').to.equal(IntrinsicEnum, 'enum class');
                        expect(expr.objectRef.getRef(), 'objectRef').to.equal(enumSymbol, 'enum object');
                    } else {
                        expect(stm.expression.getType().getRef().outer).to.equal(enumSymbol, 'enum object');
                    }
                }
            }
        });

        it('Usage in DefaultProperties', () => {
            const symbol = documentClass.getSymbol<UCDefaultPropertiesBlock>(toName('Default'));
            expect(symbol, 'symbol').to.not.be.undefined;
            expect(symbol.block, 'symbol block').to.not.be.undefined;
            for (const stm of symbol.block.statements) {
                if (stm instanceof UCDefaultAssignmentExpression) {
                    expect(stm.left.getType().getRef()).to.equal(enumSymbol);
                    expect(stm.right.getType().getRef().outer).to.equal(enumSymbol);
                } else if (stm instanceof UCDefaultElementAccessExpression) {
                    expect(stm.expression.getType().getRef()).to.equal(enumSymbol);
                    expect(stm.argument.getType().getRef().outer).to.equal(enumSymbol);
                }
            }
        });
    });
});