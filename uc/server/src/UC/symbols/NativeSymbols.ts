import { toName, NAME_CLASS, NAME_ARRAY } from '../names';

import {
	UCPackage,
	UCNativeSymbol,
	UCStructSymbol,
	UCClassSymbol,
	UCPropertySymbol,
	UCMethodSymbol,
	UCMethodLikeSymbol,
	UCTypeSymbol,
	UCParamSymbol,
	SymbolsTable
} from ".";
import { UCTypeKind } from './TypeKind';
import { DEFAULT_RANGE } from './Symbol';

export const ObjectType = new UCTypeSymbol({ name: toName('Object'), range: DEFAULT_RANGE }, DEFAULT_RANGE, UCTypeKind.Class);
export const ArgumentType = new UCTypeSymbol({ name: toName('Argument'), range: DEFAULT_RANGE });
export const IntType = new UCTypeSymbol({ name: toName('int'), range: DEFAULT_RANGE });
export const FloatType = new UCTypeSymbol({ name: toName('float'), range: DEFAULT_RANGE });
export const PropertyType = new UCTypeSymbol({ name: toName('Property'), range: DEFAULT_RANGE });
export const VectorType = new UCTypeSymbol({ name: toName('Vector'), range: DEFAULT_RANGE });
export const RotatorType = new UCTypeSymbol({ name: toName('Rotator'), range: DEFAULT_RANGE });
export const RangeType = new UCTypeSymbol({ name: toName('Range'), range: DEFAULT_RANGE });

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
NativeClass.extendsType = ObjectType;

// Not really a class, but valid as an object literal where enum is given as the class? e.g. Enum'ENetRole'
export const NativeEnum = new UCClassSymbol({ name: toName('Enum'), range: DEFAULT_RANGE });

export const NativeArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });

const LengthProperty = new UCPropertySymbol({ name: toName('Length'), range: DEFAULT_RANGE });
LengthProperty.type = new UCTypeSymbol({ name: toName('int'), range: DEFAULT_RANGE });
NativeArray.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: toName('Insert'), range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertFunction);

const IndexParam = new UCParamSymbol({ name: toName('index'), range: DEFAULT_RANGE });
IndexParam.type = IntType;
InsertFunction.addSymbol(IndexParam);

const CountParam = new UCParamSymbol({ name: toName('count'), range: DEFAULT_RANGE });
CountParam.type = IntType;
InsertFunction.addSymbol(CountParam);

InsertFunction.params = [IndexParam, CountParam];

const RemoveFunction = new UCMethodSymbol({ name: toName('Remove'), range: DEFAULT_RANGE });
NativeArray.addSymbol(RemoveFunction);

const AddFunction = new UCMethodSymbol({ name: toName('Add'), range: DEFAULT_RANGE });
NativeArray.addSymbol(AddFunction);

const AddItemFunction = new UCMethodSymbol({ name: toName('AddItem'), range: DEFAULT_RANGE });
NativeArray.addSymbol(AddItemFunction);

const InsertItemFunction = new UCMethodSymbol({ name: toName('InsertItem'), range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertItemFunction);

const RemoveItemFunction = new UCMethodSymbol({ name: toName('RemoveItem'), range: DEFAULT_RANGE });
NativeArray.addSymbol(RemoveItemFunction);

const FindFunction = new UCMethodSymbol({ name: toName('Find'), range: DEFAULT_RANGE });
NativeArray.addSymbol(FindFunction);

const SortFunction = new UCMethodSymbol({ name: toName('Sort'), range: DEFAULT_RANGE });
NativeArray.addSymbol(SortFunction);

export const VectMethodLike = new UCMethodLikeSymbol(toName('vect'));
VectMethodLike.returnType = VectorType;

const XParam = new UCParamSymbol({ name: toName('X'), range: DEFAULT_RANGE });
XParam.type = FloatType;
VectMethodLike.addSymbol(XParam);

const YParam = new UCParamSymbol({ name: toName('Y'), range: DEFAULT_RANGE });
YParam.type = FloatType;
VectMethodLike.addSymbol(YParam);

const ZParam = new UCParamSymbol({ name: toName('Z'), range: DEFAULT_RANGE });
ZParam.type = FloatType;
VectMethodLike.addSymbol(ZParam);

VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol(toName('rot'));
RotMethodLike.returnType = RotatorType;

const PitchParam = new UCParamSymbol({ name: toName('Pitch'), range: DEFAULT_RANGE });
PitchParam.type = IntType;
RotMethodLike.addSymbol(PitchParam);

const YawParam = new UCParamSymbol({ name: toName('Yaw'), range: DEFAULT_RANGE });
YawParam.type = IntType;
RotMethodLike.addSymbol(YawParam);

const RollParam = new UCParamSymbol({ name: toName('Roll'), range: DEFAULT_RANGE });
RollParam.type = IntType;
RotMethodLike.addSymbol(RollParam);

RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol(toName('rng'));
RngMethodLike.returnType = RangeType;

const MinParam = new UCParamSymbol({ name: toName('Min'), range: DEFAULT_RANGE });
MinParam.type = FloatType;
RngMethodLike.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: toName('Max'), range: DEFAULT_RANGE });
MaxParam.type = FloatType;
RngMethodLike.addSymbol(MaxParam);

RngMethodLike.params = [MinParam, MaxParam];

export const AssignmentOperator = new UCMethodLikeSymbol(toName('='), 'operator');
const AParam = new UCParamSymbol({ name: toName('variable'), range: DEFAULT_RANGE });
AParam.type = PropertyType;
AssignmentOperator.addSymbol(AParam);

const BParam = new UCParamSymbol({ name: toName('value'), range: DEFAULT_RANGE });
BParam.type = ArgumentType;
AssignmentOperator.addSymbol(BParam);

AssignmentOperator.params = [AParam, BParam];

export const CORE_PACKAGE = new UCPackage('Core');

// IMPORTANT: This package must be added before adding anything to the CORE_PACKAGE!
SymbolsTable.addSymbol(CORE_PACKAGE);

CORE_PACKAGE.addSymbol(NativeClass);
CORE_PACKAGE.addSymbol(NativeEnum);
CORE_PACKAGE.addSymbol(NativeArray);
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('byte')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('float')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('int')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('string')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('name')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('bool')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('pointer')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('map')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('Delegate')));
CORE_PACKAGE.addSymbol(new UCNativeSymbol(toName('button')));
CORE_PACKAGE.addSymbol(PropertyType);
