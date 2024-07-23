import { expect } from "chai";
import { DEFAULT_RANGE, IntrinsicClass, IntrinsicObject, StaticBoolType, StaticByteType, StaticConstIntType, StaticDelegateType, StaticErrorType, StaticFloatType, StaticIntType, StaticNoneType, StaticStringType, UCConversionCost, UCObjectTypeSymbol, getConversionCost, type UCTypeSymbol } from '.';
import {
    TypeMatchFlags,
    TypeMatchReport,
    typesMatch,
} from './';
import { ModifierFlags } from './ModifierFlags';

describe("TypeSymbols", () => {
    it("should have conversion costs", () => {
        expect(typesMatch(StaticErrorType, StaticByteType, TypeMatchFlags.None))
            .is.equal(TypeMatchReport.Undetermined);

        expect(typesMatch(StaticErrorType, StaticErrorType, TypeMatchFlags.None))
            .is.equal(TypeMatchReport.Undetermined);

        // Extra sanity check to verify we indeed have picked up the out flag :P
        const StaticOutFloatType: UCTypeSymbol = Object.create(
            StaticFloatType,
            { flags: { value: ModifierFlags.Out } }
        );

        const StaticOutIntType: UCTypeSymbol = Object.create(
            StaticIntType,
            { flags: { value: ModifierFlags.Out } }
        );

        const StaticCoerceStringType: UCTypeSymbol = Object.create(
            StaticStringType,
            { flags: { value: ModifierFlags.Coerce } }
        );

        expect(StaticOutFloatType.flags & ModifierFlags.Out)
            .is.equal(ModifierFlags.Out);

        expect(getConversionCost(StaticFloatType, StaticIntType))
            .is.equal(UCConversionCost.Truncation);
        expect(getConversionCost(StaticIntType, StaticFloatType))
            .is.equal(UCConversionCost.Shift);

        // 'Out' types cannot be 'generalized'
        expect(getConversionCost(StaticIntType, StaticOutFloatType))
            .is.equal(UCConversionCost.Illegal);

        expect(getConversionCost(StaticIntType, StaticOutIntType))
            .is.equal(UCConversionCost.Zero);

        expect(getConversionCost(StaticByteType, StaticIntType))
            .is.equal(UCConversionCost.Expansion);
        expect(getConversionCost(StaticIntType, StaticByteType))
            .is.equal(UCConversionCost.Truncation);

        const intrinsicClassType = new UCObjectTypeSymbol({
            name: IntrinsicClass.getName(),
            range: DEFAULT_RANGE,
        });
        intrinsicClassType.setRefNoIndex(IntrinsicClass);

        const intrinsicObjectType = new UCObjectTypeSymbol({
            name: IntrinsicObject.getName(),
            range: DEFAULT_RANGE,
        });
        intrinsicObjectType.setRefNoIndex(IntrinsicObject);

        expect(getConversionCost(intrinsicClassType, intrinsicObjectType))
            .is.not.equal(UCConversionCost.Illegal);

        expect(getConversionCost(intrinsicObjectType, StaticCoerceStringType))
            .is.equal(UCConversionCost.Expansion);
    });

    it("should match types", () => {
        const StaticOutByteType: UCTypeSymbol = Object.create(StaticByteType, {
            flags: { value: ModifierFlags.Out },
        });

        const StaticOutBoolType: UCTypeSymbol = Object.create(StaticBoolType, {
            flags: { value: ModifierFlags.Out },
        });

        expect(typesMatch(StaticByteType, StaticByteType, TypeMatchFlags.None))
            .is.equals(TypeMatchReport.Identical);
        expect(typesMatch(StaticByteType, StaticOutByteType, TypeMatchFlags.None))
            .is.equals(TypeMatchReport.Identical);

        expect(typesMatch(StaticIntType, StaticByteType, TypeMatchFlags.Coerce))
            .is.equals(TypeMatchReport.Convertable);
        expect(typesMatch(StaticIntType, StaticByteType, TypeMatchFlags.None))
            .is.equals(TypeMatchReport.Incompatible);
        expect(typesMatch(StaticFloatType, StaticByteType, TypeMatchFlags.None))
            .is.equals(TypeMatchReport.Incompatible);
        expect(typesMatch(StaticIntType, StaticFloatType, TypeMatchFlags.Generalize))
            .is.equals(TypeMatchReport.Expandable);

        expect(typesMatch(StaticIntType, StaticOutBoolType, TypeMatchFlags.Generalize | TypeMatchFlags.SuppressOut))
            .is.equals(TypeMatchReport.Incompatible);
        expect(typesMatch(StaticConstIntType, StaticBoolType, TypeMatchFlags.Generalize))
            .is.equals(TypeMatchReport.Incompatible);

        expect(typesMatch(StaticNoneType, StaticDelegateType, TypeMatchFlags.Generalize))
            .is.equals(TypeMatchReport.Compatible);
    });
});
