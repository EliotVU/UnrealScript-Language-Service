import {
	toName,
	NAME_CLASS, NAME_ARRAY, NAME_INT, NAME_FLOAT,
	NAME_ENUM, NAME_PACKAGE, NAME_BYTE, NAME_STRING,
	NAME_NAME, NAME_BOOL,
	NAME_BUTTON, NAME_PROPERTY,
	NAME_CORE, NAME_BYTEPROPERTY, NAME_INTPROPERTY,
	NAME_OBJECTPROPERTY, NAME_FLOATPROPERTY, NAME_NAMEPROPERTY,
	NAME_STRINGPROPERTY, NAME_STRPROPERTY, NAME_BOOLPROPERTY,
	NAME_POINTERPROPERTY, NAME_MAPPROPERTY, NAME_DELEGATEPROPERTY,
	NAME_ARRAYPROPERTY, NAME_CLASSPROPERTY, Name
} from '../names';

import {
	DEFAULT_RANGE,
	UCPackage,
	UCStructSymbol,
	UCClassSymbol,
	UCPropertySymbol,
	UCMethodSymbol,
	UCMethodLikeSymbol,
	UCParamSymbol,
	UCIntTypeSymbol, UCFloatTypeSymbol,
	UCByteTypeSymbol, UCStringTypeSymbol,
	UCNameTypeSymbol, UCBoolTypeSymbol,
	UCButtonTypeSymbol
} from ".";
import { UCPredefinedTypeSymbol, StaticObjectType, StaticIntType, StaticVectorType, StaticFloatType, StaticRotatorType, StaticRangeType, StaticByteType, StaticStringType, StaticNameType, StaticBoolType, ITypeSymbol } from './TypeSymbol';
import { ObjectsTable } from './Package';

export const NativeProperty = new UCClassSymbol({ name: NAME_PROPERTY, range: DEFAULT_RANGE });
NativeProperty.extendsType = StaticObjectType;

export const NativeByteProperty = new UCClassSymbol({ name: NAME_BYTEPROPERTY, range: DEFAULT_RANGE });
NativeByteProperty.extendsType = StaticObjectType;

export const NativeFloatProperty = new UCClassSymbol({ name: NAME_FLOATPROPERTY, range: DEFAULT_RANGE });
NativeFloatProperty.extendsType = StaticObjectType;

export const NativeIntProperty = new UCClassSymbol({ name: NAME_INTPROPERTY, range: DEFAULT_RANGE });
NativeIntProperty.extendsType = StaticObjectType;

export const NativeNameProperty = new UCClassSymbol({ name: NAME_NAMEPROPERTY, range: DEFAULT_RANGE });
NativeNameProperty.extendsType = StaticObjectType;

export const NativeStringProperty = new UCClassSymbol({ name: NAME_STRINGPROPERTY, range: DEFAULT_RANGE });
NativeStringProperty.extendsType = StaticObjectType;

export const NativeStrProperty = new UCClassSymbol({ name: NAME_STRPROPERTY, range: DEFAULT_RANGE });
NativeStrProperty.extendsType = StaticObjectType;

export const NativeBoolProperty = new UCClassSymbol({ name: NAME_BOOLPROPERTY, range: DEFAULT_RANGE });
NativeBoolProperty.extendsType = StaticObjectType;

export const NativePointerProperty = new UCClassSymbol({ name: NAME_POINTERPROPERTY, range: DEFAULT_RANGE });
NativePointerProperty.extendsType = StaticObjectType;

export const NativeMapProperty = new UCClassSymbol({ name: NAME_MAPPROPERTY, range: DEFAULT_RANGE });
NativeMapProperty.extendsType = StaticObjectType;

export const NativeDelegateProperty = new UCClassSymbol({ name: NAME_DELEGATEPROPERTY, range: DEFAULT_RANGE });
NativeDelegateProperty.extendsType = StaticObjectType;

export const NativeArrayProperty = new UCClassSymbol({ name: NAME_ARRAYPROPERTY, range: DEFAULT_RANGE });
NativeArrayProperty.extendsType = StaticObjectType;

export const NativeClassProperty = new UCClassSymbol({ name: NAME_CLASSPROPERTY, range: DEFAULT_RANGE });
NativeClassProperty.extendsType = StaticObjectType;

export const NativeObjectProperty = new UCClassSymbol({ name: NAME_OBJECTPROPERTY, range: DEFAULT_RANGE });
NativeObjectProperty.extendsType = StaticObjectType;

export const NativePackage = new UCClassSymbol({ name: NAME_PACKAGE, range: DEFAULT_RANGE });
NativePackage.extendsType = StaticObjectType;

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
NativeClass.extendsType = StaticObjectType;

export const NativeEnum = new UCClassSymbol({ name: NAME_ENUM, range: DEFAULT_RANGE });
NativeEnum.extendsType = StaticObjectType;

// HACK: Not truly an uc object, but since NativeArray has psuedo properties, it's a convencience to re-use the struct's features.
export const NativeArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });

export const LengthProperty = new UCPropertySymbol({ name: toName('Length'), range: DEFAULT_RANGE });
LengthProperty.type = StaticIntType;
NativeArray.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: toName('Insert'), range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertFunction);

const IndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam.type = StaticIntType;
InsertFunction.addSymbol(IndexParam);

const CountParam = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam.type = StaticIntType;
InsertFunction.addSymbol(CountParam);

InsertFunction.params = [IndexParam, CountParam];

const RemoveFunction = new UCMethodSymbol({ name: toName('Remove'), range: DEFAULT_RANGE });
NativeArray.addSymbol(RemoveFunction);

const IndexParam2 = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam2.type = StaticIntType;
InsertFunction.addSymbol(IndexParam2);

const CountParam2 = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam2.type = StaticIntType;
RemoveFunction.addSymbol(CountParam2);

RemoveFunction.params = [IndexParam2, CountParam2];

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

export const VectMethodLike = new UCMethodLikeSymbol(toName('Vect'));
VectMethodLike.returnType = StaticVectorType;

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
RotMethodLike.returnType = StaticRotatorType;

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
RngMethodLike.returnType = StaticRangeType;

const MinParam = new UCParamSymbol({ name: toName('Min'), range: DEFAULT_RANGE });
MinParam.type = StaticFloatType;
RngMethodLike.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: toName('Max'), range: DEFAULT_RANGE });
MaxParam.type = StaticFloatType;
RngMethodLike.addSymbol(MaxParam);

RngMethodLike.params = [MinParam, MaxParam];

export const CastTypeClassMap: Readonly<WeakMap<Name, typeof UCPredefinedTypeSymbol>> = new WeakMap([
	[NAME_BYTE, UCByteTypeSymbol],
	[NAME_FLOAT, UCFloatTypeSymbol],
	[NAME_INT, UCIntTypeSymbol],
	[NAME_STRING, UCStringTypeSymbol],
	[NAME_NAME, UCNameTypeSymbol],
	[NAME_BOOL, UCBoolTypeSymbol],
	// Oddly... conversion to a button is actually valid!
	[NAME_BUTTON, UCButtonTypeSymbol]
]);

export const CastTypeSymbolMap: Readonly<WeakMap<Name, ITypeSymbol>> = new WeakMap([
	[NAME_BYTE, StaticByteType],
	[NAME_FLOAT, StaticFloatType],
	[NAME_INT, StaticIntType],
	[NAME_STRING, StaticStringType],
	[NAME_NAME, StaticNameType],
	[NAME_BOOL, StaticBoolType],
	// Oddly... conversion to a button is actually valid!
	[NAME_BUTTON, StaticBoolType]
]);

export const CORE_PACKAGE = new UCPackage(NAME_CORE);
CORE_PACKAGE.addSymbol(NativePackage);
CORE_PACKAGE.addSymbol(NativeClass);
CORE_PACKAGE.addSymbol(NativeEnum);
CORE_PACKAGE.addSymbol(NativeProperty);
CORE_PACKAGE.addSymbol(NativeByteProperty);
CORE_PACKAGE.addSymbol(NativeFloatProperty);
CORE_PACKAGE.addSymbol(NativeIntProperty);
CORE_PACKAGE.addSymbol(NativeNameProperty);
CORE_PACKAGE.addSymbol(NativeStringProperty);
CORE_PACKAGE.addSymbol(NativeStrProperty);
CORE_PACKAGE.addSymbol(NativeBoolProperty);
CORE_PACKAGE.addSymbol(NativePointerProperty);
CORE_PACKAGE.addSymbol(NativeMapProperty);
CORE_PACKAGE.addSymbol(NativeDelegateProperty);
CORE_PACKAGE.addSymbol(NativeArrayProperty);
CORE_PACKAGE.addSymbol(NativeClassProperty);
CORE_PACKAGE.addSymbol(NativeObjectProperty);

ObjectsTable.addSymbol(CORE_PACKAGE);