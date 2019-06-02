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

export const ObjectType = new UCTypeSymbol({ name: 'Object', range: DEFAULT_RANGE }, DEFAULT_RANGE, UCTypeKind.Class);
export const ArgumentType = new UCTypeSymbol({ name: 'Argument', range: DEFAULT_RANGE });
export const IntType = new UCTypeSymbol({ name: 'int', range: DEFAULT_RANGE });
export const FloatType = new UCTypeSymbol({ name: 'float', range: DEFAULT_RANGE });
export const PropertyType = new UCTypeSymbol({ name: 'Property', range: DEFAULT_RANGE });
export const VectorType = new UCTypeSymbol({ name: 'Vector', range: DEFAULT_RANGE });
export const RotatorType = new UCTypeSymbol({ name: 'Rotator', range: DEFAULT_RANGE });
export const RangeType = new UCTypeSymbol({ name: 'Range', range: DEFAULT_RANGE });

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: 'Class', range: DEFAULT_RANGE });
NativeClass.extendsType = ObjectType;

// Not really a class, but valid as an object literal where enum is given as the class? e.g. Enum'ENetRole'
export const NativeEnum = new UCClassSymbol({ name: 'Enum', range: DEFAULT_RANGE });

export const NativeArray = new UCStructSymbol({ name: 'Array', range: DEFAULT_RANGE });

const LengthProperty = new UCPropertySymbol({ name: 'Length', range: DEFAULT_RANGE });
LengthProperty.type = new UCTypeSymbol({ name: 'int', range: DEFAULT_RANGE });
NativeArray.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: 'Insert', range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertFunction);

const IndexParam = new UCParamSymbol({ name: 'index', range: DEFAULT_RANGE });
IndexParam.type = IntType;
InsertFunction.addSymbol(IndexParam);

const CountParam = new UCParamSymbol({ name: 'count', range: DEFAULT_RANGE });
CountParam.type = IntType;
InsertFunction.addSymbol(CountParam);

InsertFunction.params = [IndexParam, CountParam];

const RemoveFunction = new UCMethodSymbol({ name: 'Remove', range: DEFAULT_RANGE });
NativeArray.addSymbol(RemoveFunction);

const AddFunction = new UCMethodSymbol({ name: 'Add', range: DEFAULT_RANGE });
NativeArray.addSymbol(AddFunction);

const AddItemFunction = new UCMethodSymbol({ name: 'AddItem', range: DEFAULT_RANGE });
NativeArray.addSymbol(AddItemFunction);

const InsertItemFunction = new UCMethodSymbol({ name: 'InsertItem', range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertItemFunction);

const RemoveItemFunction = new UCMethodSymbol({ name: 'RemoveItem', range: DEFAULT_RANGE });
NativeArray.addSymbol(RemoveItemFunction);

const FindFunction = new UCMethodSymbol({ name: 'Find', range: DEFAULT_RANGE });
NativeArray.addSymbol(FindFunction);

const SortFunction = new UCMethodSymbol({ name: 'Sort', range: DEFAULT_RANGE });
NativeArray.addSymbol(SortFunction);

export const VectMethodLike = new UCMethodLikeSymbol('vect');
VectMethodLike.returnType = VectorType;

const XParam = new UCParamSymbol({ name: 'X', range: DEFAULT_RANGE });
XParam.type = FloatType;
VectMethodLike.addSymbol(XParam);

const YParam = new UCParamSymbol({ name: 'Y', range: DEFAULT_RANGE });
YParam.type = FloatType;
VectMethodLike.addSymbol(YParam);

const ZParam = new UCParamSymbol({ name: 'Z', range: DEFAULT_RANGE });
ZParam.type = FloatType;
VectMethodLike.addSymbol(ZParam);

VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol('rot');
RotMethodLike.returnType = RotatorType;

const PitchParam = new UCParamSymbol({ name: 'Pitch', range: DEFAULT_RANGE });
PitchParam.type = IntType;
RotMethodLike.addSymbol(PitchParam);

const YawParam = new UCParamSymbol({ name: 'Yaw', range: DEFAULT_RANGE });
YawParam.type = IntType;
RotMethodLike.addSymbol(YawParam);

const RollParam = new UCParamSymbol({ name: 'Roll', range: DEFAULT_RANGE });
RollParam.type = IntType;
RotMethodLike.addSymbol(RollParam);

RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol('rng');
RngMethodLike.returnType = RangeType;

const MinParam = new UCParamSymbol({ name: 'Min', range: DEFAULT_RANGE });
MinParam.type = FloatType;
RngMethodLike.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: 'Max', range: DEFAULT_RANGE });
MaxParam.type = FloatType;
RngMethodLike.addSymbol(MaxParam);

RngMethodLike.params = [MinParam, MaxParam];

export const AssignmentOperator = new UCMethodLikeSymbol('=', 'operator');
const AParam = new UCParamSymbol({ name: 'variable', range: DEFAULT_RANGE });
AParam.type = PropertyType;
AssignmentOperator.addSymbol(AParam);

const BParam = new UCParamSymbol({ name: 'value', range: DEFAULT_RANGE });
BParam.type = ArgumentType;
AssignmentOperator.addSymbol(BParam);

AssignmentOperator.params = [AParam, BParam];

export const CORE_PACKAGE = new UCPackage('Core');

// IMPORTANT: This package must be added before adding anything to the CORE_PACKAGE!
SymbolsTable.addSymbol(CORE_PACKAGE);

CORE_PACKAGE.addSymbol(NativeClass);
CORE_PACKAGE.addSymbol(NativeEnum);
CORE_PACKAGE.addSymbol(NativeArray);
CORE_PACKAGE.addSymbol(new UCNativeSymbol('byte'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('float'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('int'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('string'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('name'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('bool'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('pointer'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('map'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('Delegate'));
CORE_PACKAGE.addSymbol(new UCNativeSymbol('button'));
CORE_PACKAGE.addSymbol(PropertyType);
