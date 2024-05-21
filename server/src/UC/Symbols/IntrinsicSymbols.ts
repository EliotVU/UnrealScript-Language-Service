import { toName } from '../name';
import { NAME_ARRAY, NAME_RETURNVALUE } from '../names';
import {
    DEFAULT_RANGE,
    ModifierFlags,
    StaticDelegateType,
    StaticFloatType,
    StaticIntType,
    StaticMetaType,
    StaticNameType,
    StaticRangeType,
    StaticRotatorType,
    StaticVectorType,
    UCMethodLikeSymbol,
    UCMethodSymbol,
    UCParamSymbol,
    UCPropertySymbol,
    UCStructSymbol,
} from './';

export * from './CoreSymbols';
export * from './EngineSymbols';

// HACK: Not truly an uc object, but since NativeArray has pseudo properties, it's convenient to re-use the struct symbol features.
export const IntrinsicArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE }, DEFAULT_RANGE);
IntrinsicArray.modifiers |= ModifierFlags.Intrinsic;

export const Array_LengthProperty = new UCPropertySymbol({ name: toName('Length'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
Array_LengthProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicArray.addSymbol(Array_LengthProperty);

const Array_InsertFunction = new UCMethodSymbol({ name: toName('Insert'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_InsertFunction.modifiers |= ModifierFlags.Intrinsic;
const IndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
const CountParam = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
Array_InsertFunction.addSymbol(IndexParam);
Array_InsertFunction.addSymbol(CountParam);
Array_InsertFunction.params = [IndexParam, CountParam];
IntrinsicArray.addSymbol(Array_InsertFunction);

const Array_RemoveFunction = new UCMethodSymbol({ name: toName('Remove'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_RemoveFunction.modifiers |= ModifierFlags.Intrinsic;
const IndexParam2 = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
const CountParam2 = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
Array_RemoveFunction.addSymbol(IndexParam2);
Array_RemoveFunction.addSymbol(CountParam2);
Array_RemoveFunction.params = [IndexParam2, CountParam2];
IntrinsicArray.addSymbol(Array_RemoveFunction);

const Array_AddFunction = new UCMethodSymbol({ name: toName('Add'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_AddFunction.modifiers |= ModifierFlags.Intrinsic;
const CountParam3 = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
Array_AddFunction.addSymbol(CountParam3);
Array_AddFunction.params = [CountParam3];
IntrinsicArray.addSymbol(Array_AddFunction);

const Array_AddItemFunction = new UCMethodSymbol({ name: toName('AddItem'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_AddItemFunction.modifiers |= ModifierFlags.Intrinsic;
const ItemParam = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
Array_AddItemFunction.addSymbol(ItemParam);
Array_AddItemFunction.params = [ItemParam];
IntrinsicArray.addSymbol(Array_AddItemFunction);

const Array_InsertItemFunction = new UCMethodSymbol({ name: toName('InsertItem'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_InsertItemFunction.modifiers |= ModifierFlags.Intrinsic;
const IndexParam3 = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
const ItemParam2 = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
Array_InsertItemFunction.addSymbol(IndexParam3);
Array_InsertItemFunction.addSymbol(ItemParam2);
Array_InsertItemFunction.params = [IndexParam3, ItemParam2];
IntrinsicArray.addSymbol(Array_InsertItemFunction);

const Array_RemoveItemFunction = new UCMethodSymbol({ name: toName('RemoveItem'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_RemoveItemFunction.modifiers |= ModifierFlags.Intrinsic;
const ItemParam3 = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
Array_RemoveItemFunction.addSymbol(ItemParam3);
Array_RemoveItemFunction.params = [ItemParam3];
IntrinsicArray.addSymbol(Array_RemoveItemFunction);

const Array_FindFunction = new UCMethodSymbol({ name: toName('Find'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_FindFunction.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.ReadOnly;
const ItemParam4 = new UCParamSymbol({ name: toName('Value'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
Array_FindFunction.addSymbol(ItemParam4);
Array_FindFunction.params = [ItemParam4];
IntrinsicArray.addSymbol(Array_FindFunction);

const Array_FindMemberFunction = new UCMethodSymbol({ name: toName('Find'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_FindMemberFunction.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.ReadOnly;
const ItemParam6 = new UCParamSymbol({ name: toName('PropertyName'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticNameType);
Array_FindMemberFunction.addSymbol(ItemParam6);
const ItemParam7 = new UCParamSymbol({ name: toName('Value'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticNameType);
Array_FindMemberFunction.addSymbol(ItemParam7);
Array_FindMemberFunction.params = [ItemParam6, ItemParam7];
IntrinsicArray.addSymbol(Array_FindMemberFunction);

const Array_SortFunction = new UCMethodSymbol({ name: toName('Sort'), range: DEFAULT_RANGE }, DEFAULT_RANGE);
Array_SortFunction.modifiers |= ModifierFlags.Intrinsic;
const PredicateParam = new UCParamSymbol({ name: toName('Predicate'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticDelegateType);
Array_SortFunction.addSymbol(PredicateParam);
Array_SortFunction.params = [PredicateParam];
IntrinsicArray.addSymbol(Array_SortFunction);

const ReturnValueIdentifier = { name: NAME_RETURNVALUE, range: DEFAULT_RANGE };

const VectorReturnValue = new UCParamSymbol(ReturnValueIdentifier, DEFAULT_RANGE, StaticVectorType);
const RotatorReturnValue = new UCParamSymbol(ReturnValueIdentifier, DEFAULT_RANGE, StaticRotatorType);
const RangeReturnValue = new UCParamSymbol(ReturnValueIdentifier, DEFAULT_RANGE, StaticRangeType);

export const IntrinsicVectLiteral = new UCMethodLikeSymbol(toName('Vect'));
IntrinsicVectLiteral.returnValue = VectorReturnValue;

const XParam = new UCParamSymbol({ name: toName('X'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticFloatType);
XParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicVectLiteral.addSymbol(XParam);

const YParam = new UCParamSymbol({ name: toName('Y'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticFloatType);
YParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicVectLiteral.addSymbol(YParam);

const ZParam = new UCParamSymbol({ name: toName('Z'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticFloatType);
ZParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicVectLiteral.addSymbol(ZParam);

IntrinsicVectLiteral.params = [XParam, YParam, ZParam];

export const IntrinsicRotLiteral = new UCMethodLikeSymbol(toName('Rot'));
IntrinsicRotLiteral.returnValue = RotatorReturnValue;

const PitchParam = new UCParamSymbol({ name: toName('Pitch'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
PitchParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicRotLiteral.addSymbol(PitchParam);

const YawParam = new UCParamSymbol({ name: toName('Yaw'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
YawParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicRotLiteral.addSymbol(YawParam);

const RollParam = new UCParamSymbol({ name: toName('Roll'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
RollParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicRotLiteral.addSymbol(RollParam);

IntrinsicRotLiteral.params = [PitchParam, YawParam, RollParam];

export const IntrinsicRngLiteral = new UCMethodLikeSymbol(toName('Rng'));
IntrinsicRngLiteral.returnValue = RangeReturnValue;

const MinParam = new UCParamSymbol({ name: toName('Min'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticFloatType);
MinParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicRngLiteral.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: toName('Max'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticFloatType);
MinParam.modifiers |= ModifierFlags.ReadOnly;
IntrinsicRngLiteral.addSymbol(MaxParam);

IntrinsicRngLiteral.params = [MinParam, MaxParam];

