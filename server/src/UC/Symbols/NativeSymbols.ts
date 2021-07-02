import { NAME_ARRAY, NAME_RETURNVALUE, toName } from '../names';
import {
    DEFAULT_RANGE, UCMethodLikeSymbol, UCMethodSymbol, UCParamSymbol, UCPropertySymbol,
    UCStructSymbol
} from './';
import {
    StaticDelegateType, StaticFloatType, StaticIntType, StaticRangeType, StaticRotatorType,
    StaticVectorType
} from './TypeSymbol';

export * from './CoreSymbols';

// HACK: Not truly an uc object, but since NativeArray has psuedo properties, it's a convencience to re-use the struct's features.
export const NativeArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });

export const LengthProperty = new UCPropertySymbol({ name: toName('Length'), range: DEFAULT_RANGE });
LengthProperty.type = StaticIntType;
NativeArray.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: toName('Insert'), range: DEFAULT_RANGE });
const IndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam.type = StaticIntType;
const CountParam = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam.type = StaticIntType;
InsertFunction.addSymbol(IndexParam);
InsertFunction.addSymbol(CountParam);
InsertFunction.params = [IndexParam, CountParam];
NativeArray.addSymbol(InsertFunction);

const RemoveFunction = new UCMethodSymbol({ name: toName('Remove'), range: DEFAULT_RANGE });
const IndexParam2 = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam2.type = StaticIntType;
const CountParam2 = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam2.type = StaticIntType;
RemoveFunction.addSymbol(IndexParam2);
RemoveFunction.addSymbol(CountParam2);
RemoveFunction.params = [IndexParam2, CountParam2];
NativeArray.addSymbol(RemoveFunction);

const AddFunction = new UCMethodSymbol({ name: toName('Add'), range: DEFAULT_RANGE });
const CountParam3 = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam3.type = StaticIntType;
AddFunction.addSymbol(CountParam3);
AddFunction.params = [CountParam3];
NativeArray.addSymbol(AddFunction);

const AddItemFunction = new UCMethodSymbol({ name: toName('AddItem'), range: DEFAULT_RANGE });
const ItemParam = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE });
AddItemFunction.addSymbol(ItemParam);
AddItemFunction.params = [ItemParam];
NativeArray.addSymbol(AddItemFunction);

const InsertItemFunction = new UCMethodSymbol({ name: toName('InsertItem'), range: DEFAULT_RANGE });
const IndexParam3 = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam3.type = StaticIntType;
const ItemParam2 = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE });
InsertItemFunction.addSymbol(IndexParam3);
InsertItemFunction.addSymbol(ItemParam2);
InsertItemFunction.params = [IndexParam3, ItemParam2];
NativeArray.addSymbol(InsertItemFunction);

const RemoveItemFunction = new UCMethodSymbol({ name: toName('RemoveItem'), range: DEFAULT_RANGE });
const ItemParam3 = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE });
RemoveItemFunction.addSymbol(ItemParam3);
RemoveItemFunction.params = [ItemParam3];
NativeArray.addSymbol(RemoveItemFunction);

const FindFunction = new UCMethodSymbol({ name: toName('Find'), range: DEFAULT_RANGE });
const ItemParam4 = new UCParamSymbol({ name: toName('Item'), range: DEFAULT_RANGE });
FindFunction.addSymbol(ItemParam4);
FindFunction.params = [ItemParam4];
NativeArray.addSymbol(FindFunction);

const SortFunction = new UCMethodSymbol({ name: toName('Sort'), range: DEFAULT_RANGE });
const PredicateParam = new UCParamSymbol({ name: toName('Predicate'), range: DEFAULT_RANGE });
PredicateParam.type = StaticDelegateType;
SortFunction.addSymbol(PredicateParam);
SortFunction.params = [PredicateParam];
NativeArray.addSymbol(SortFunction);

export const ReturnValueIdentifier = { name: NAME_RETURNVALUE, range: DEFAULT_RANGE };

const VectorReturnValue = new UCParamSymbol(ReturnValueIdentifier);
VectorReturnValue.type = StaticVectorType;

const RotatorReturnValue = new UCParamSymbol(ReturnValueIdentifier);
RotatorReturnValue.type = StaticRotatorType;

const RangeReturnValue = new UCParamSymbol(ReturnValueIdentifier);
RangeReturnValue.type = StaticRangeType;

export const VectMethodLike = new UCMethodLikeSymbol(toName('Vect'));
VectMethodLike.returnValue = VectorReturnValue;

const XParam = new UCParamSymbol({ name: toName('X'), range: DEFAULT_RANGE });
XParam.type = StaticFloatType;
VectMethodLike.addSymbol(XParam);

const YParam = new UCParamSymbol({ name: toName('Y'), range: DEFAULT_RANGE });
YParam.type = StaticFloatType;
VectMethodLike.addSymbol(YParam);

const ZParam = new UCParamSymbol({ name: toName('Z'), range: DEFAULT_RANGE });
ZParam.type = StaticFloatType;
VectMethodLike.addSymbol(ZParam);

VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol(toName('Rot'));
RotMethodLike.returnValue = RotatorReturnValue;

const PitchParam = new UCParamSymbol({ name: toName('Pitch'), range: DEFAULT_RANGE });
PitchParam.type = StaticIntType;
RotMethodLike.addSymbol(PitchParam);

const YawParam = new UCParamSymbol({ name: toName('Yaw'), range: DEFAULT_RANGE });
YawParam.type = StaticIntType;
RotMethodLike.addSymbol(YawParam);

const RollParam = new UCParamSymbol({ name: toName('Roll'), range: DEFAULT_RANGE });
RollParam.type = StaticIntType;
RotMethodLike.addSymbol(RollParam);

RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol(toName('Rng'));
RngMethodLike.returnValue = RangeReturnValue;

const MinParam = new UCParamSymbol({ name: toName('Min'), range: DEFAULT_RANGE });
MinParam.type = StaticFloatType;
RngMethodLike.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: toName('Max'), range: DEFAULT_RANGE });
MaxParam.type = StaticFloatType;
RngMethodLike.addSymbol(MaxParam);

RngMethodLike.params = [MinParam, MaxParam];

