import { expect } from 'chai';

import { DEFAULT_RANGE, StaticByteType, StaticErrorType, StaticFloatType, StaticIntType, StaticVectorType, UCConversionCost, UCObjectTypeSymbol, UCTypeKind, findOverloadedBinaryOperator, getConversionCost, isOperator } from '../../Symbols';
import { indexDocument, queueIndexDocument } from '../../indexer';
import { assertDocumentAnalysis } from '../utils/diagnosticUtils';
import { usingDocuments } from '../utils/utils';
import { toName } from '../../name';

describe('Overloading', () => {
    // Run some additional "real-examples" to verify that we have no reported diagnostics where it is not expected.
    it('should have no problems', () => {
        usingDocuments(__dirname, ['Overloads.uc', 'OverloadingTest.uc'], ([, testDocument]) => {
            queueIndexDocument(testDocument);
            assertDocumentAnalysis(testDocument, /\bShould/).is.equal(0);
            assertDocumentAnalysis(testDocument, /\bInvalid/).is.equal(2);
        });
    });

    it('should overload operators', () => {
        usingDocuments(__dirname, ['Overloads.uc'], ([overloadsDocument]) => {
            indexDocument(overloadsDocument);

            // Confirm that all declared operators can be found by the overloading utilities if they are a perfect match.
            for (let field = overloadsDocument.class.operators; field; field = field.next) {
                if (!isOperator(field) || !field.isBinaryOperator()) {
                    continue;
                }

                const typeA = field.params[0].getType();
                const typeB = field.params[1].getType();
                const overloadedOperator = findOverloadedBinaryOperator(overloadsDocument.class, field.getName(), typeA, typeB);
                expect(overloadedOperator, `Overloadable operator '${field.getTooltip()}' couldn't be overloaded.`).to.not.be.undefined;
                expect(overloadedOperator, `Overloadable operator '${field.getTooltip()}' matched with an invalid operator '${overloadedOperator.getTooltip()}'`).is.equal(field);
            }

            // 1.0 + 1.0 should match the operator with zero cost, and thus return a float type. Special test case here for this one particular type, as it is causing problems.
            const floatAdditionOperator = findOverloadedBinaryOperator(overloadsDocument.class, toName('+'), StaticFloatType, StaticFloatType);
            expect(floatAdditionOperator.returnValue.getType().getTypeKind()).is.equal(UCTypeKind.Float);

            // Test overloading against coerced types like an enum.
            const enumOne = overloadsDocument.class!.findSuperSymbol(toName('EnumOne'));
            const enumOneType = new UCObjectTypeSymbol({ name: enumOne.getName(), range: DEFAULT_RANGE });
            enumOneType.setRef(enumOne, overloadsDocument);

            expect(getConversionCost(StaticByteType, enumOneType)).is.equal(UCConversionCost.Expansion);
            expect(getConversionCost(enumOneType, StaticIntType)).is.equal(UCConversionCost.Expansion);

            // The enum is expected to be coerced to an integer, as well as for the byte operand.
            const enumOperator = findOverloadedBinaryOperator(overloadsDocument.class, toName('=='), enumOneType, StaticByteType);
            expect(enumOperator).to.not.be.undefined;
            expect(enumOperator.params![0].getType().getTypeKind()).is.equal(UCTypeKind.Int);
            expect(enumOperator.params![1].getType().getTypeKind()).is.equal(UCTypeKind.Int);

            // Test overloading against two unrelated struct types.
            const structOne = overloadsDocument.class!.findSuperSymbol(toName('StructOne'));
            const structTwo = overloadsDocument.class!.findSuperSymbol(toName('StructTwo'));
            const structOneType = new UCObjectTypeSymbol({ name: structOne.getName(), range: DEFAULT_RANGE });
            structOneType.setRef(structOne, overloadsDocument);
            const structTwoType = new UCObjectTypeSymbol({ name: structTwo.getName(), range: DEFAULT_RANGE });
            structTwoType.setRef(structTwo, overloadsDocument);
            expect(getConversionCost(structOneType, structOneType)).is.equal(UCConversionCost.Zero);
            expect(getConversionCost(structOneType, structTwoType)).is.equal(UCConversionCost.Illegal);
        });
    });

    // Should move this to somewhere else, but for now confirm that we have working conversion costs for some well known types.
    it('conversion costs', () => {
        expect(getConversionCost(StaticErrorType, StaticFloatType)).is.equal(UCConversionCost.Illegal);
        expect(getConversionCost(StaticFloatType, StaticFloatType)).is.equal(UCConversionCost.Zero);

        expect(getConversionCost(StaticFloatType, StaticIntType)).is.equal(UCConversionCost.Truncation);
        expect(getConversionCost(StaticIntType, StaticFloatType)).is.equal(UCConversionCost.Shift);

        expect(getConversionCost(StaticByteType, StaticIntType)).is.equal(UCConversionCost.Expansion);
        expect(getConversionCost(StaticIntType, StaticByteType)).is.equal(UCConversionCost.Truncation);
    });
});
