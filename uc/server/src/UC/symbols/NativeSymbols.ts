import {
	toName,
	NAME_CLASS, NAME_ARRAY, NAME_INT, NAME_FLOAT,
	NAME_ENUM, NAME_PACKAGE, NAME_BYTE, NAME_STRING, NAME_NAME, NAME_BOOL, NAME_POINTER, NAME_MAP, NAME_BUTTON, NAME_OBJECT, NAME_PROPERTY, NAME_CORE, NAME_BYTEPROPERTY, NAME_INTPROPERTY, NAME_OBJECTPROPERTY, NAME_FLOATPROPERTY, NAME_NAMEPROPERTY, NAME_STRINGPROPERTY, NAME_STRPROPERTY, NAME_BOOLPROPERTY, NAME_POINTERPROPERTY, NAME_MAPPROPERTY, NAME_DELEGATEPROPERTY, NAME_ARRAYPROPERTY, NAME_CLASSPROPERTY, Name
} from '../names';

import {
	UCPackage,
	UCStructSymbol,
	UCClassSymbol,
	UCPropertySymbol,
	UCMethodSymbol,
	UCMethodLikeSymbol,
	UCTypeSymbol,
	UCParamSymbol,
	SymbolsTable,
	PackagesTable
} from ".";
import { UCTypeKind } from './TypeKind';
import { DEFAULT_RANGE } from './Symbol';
import { UCNativeType } from './NativeType';

export const ObjectTypeRef = new UCTypeSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE }, DEFAULT_RANGE, UCTypeKind.Class);
export const ArgumentTypeRef = new UCTypeSymbol({ name: toName('Argument'), range: DEFAULT_RANGE });
export const IntTypeRef = new UCTypeSymbol({ name: NAME_INT, range: DEFAULT_RANGE });
export const FloatTypeRef = new UCTypeSymbol({ name: NAME_FLOAT, range: DEFAULT_RANGE });
export const VectorTypeRef = new UCTypeSymbol({ name: toName('Vector'), range: DEFAULT_RANGE });
export const RotatorTypeRef = new UCTypeSymbol({ name: toName('Rotator'), range: DEFAULT_RANGE });
export const RangeTypeRef = new UCTypeSymbol({ name: toName('Range'), range: DEFAULT_RANGE });

export const NativeProperty = new UCClassSymbol({ name: NAME_PROPERTY, range: DEFAULT_RANGE });
NativeProperty.extendsType = ObjectTypeRef;

export const NativeByteProperty = new UCClassSymbol({ name: NAME_BYTEPROPERTY, range: DEFAULT_RANGE });
NativeByteProperty.extendsType = ObjectTypeRef;

export const NativeFloatProperty = new UCClassSymbol({ name: NAME_FLOATPROPERTY, range: DEFAULT_RANGE });
NativeFloatProperty.extendsType = ObjectTypeRef;

export const NativeIntProperty = new UCClassSymbol({ name: NAME_INTPROPERTY, range: DEFAULT_RANGE });
NativeIntProperty.extendsType = ObjectTypeRef;

export const NativeNameProperty = new UCClassSymbol({ name: NAME_NAMEPROPERTY, range: DEFAULT_RANGE });
NativeNameProperty.extendsType = ObjectTypeRef;

export const NativeStringProperty = new UCClassSymbol({ name: NAME_STRINGPROPERTY, range: DEFAULT_RANGE });
NativeStringProperty.extendsType = ObjectTypeRef;

export const NativeStrProperty = new UCClassSymbol({ name: NAME_STRPROPERTY, range: DEFAULT_RANGE });
NativeStrProperty.extendsType = ObjectTypeRef;

export const NativeBoolProperty = new UCClassSymbol({ name: NAME_BOOLPROPERTY, range: DEFAULT_RANGE });
NativeBoolProperty.extendsType = ObjectTypeRef;

export const NativePointerProperty = new UCClassSymbol({ name: NAME_POINTERPROPERTY, range: DEFAULT_RANGE });
NativePointerProperty.extendsType = ObjectTypeRef;

export const NativeMapProperty = new UCClassSymbol({ name: NAME_MAPPROPERTY, range: DEFAULT_RANGE });
NativeMapProperty.extendsType = ObjectTypeRef;

export const NativeDelegateProperty = new UCClassSymbol({ name: NAME_DELEGATEPROPERTY, range: DEFAULT_RANGE });
NativeDelegateProperty.extendsType = ObjectTypeRef;

export const NativeArrayProperty = new UCClassSymbol({ name: NAME_ARRAYPROPERTY, range: DEFAULT_RANGE });
NativeArrayProperty.extendsType = ObjectTypeRef;

export const NativeClassProperty = new UCClassSymbol({ name: NAME_CLASSPROPERTY, range: DEFAULT_RANGE });
NativeClassProperty.extendsType = ObjectTypeRef;

export const NativeObjectProperty = new UCClassSymbol({ name: NAME_OBJECTPROPERTY, range: DEFAULT_RANGE });
NativeObjectProperty.extendsType = ObjectTypeRef;

export const NativePackage = new UCClassSymbol({ name: NAME_PACKAGE, range: DEFAULT_RANGE });
NativePackage.extendsType = ObjectTypeRef;

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
NativeClass.extendsType = ObjectTypeRef;

export const NativeEnum = new UCClassSymbol({ name: NAME_ENUM, range: DEFAULT_RANGE });
NativeEnum.extendsType = ObjectTypeRef;

// HACK: Not truly objects, should be a UCNativeType, but since NativeArray has psudo properties, it's a convencience to re-use the struct' behavior.
export const NativeMap = new UCStructSymbol({ name: NAME_MAP, range: DEFAULT_RANGE });
export const NativeArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });

const LengthProperty = new UCPropertySymbol({ name: toName('Length'), range: DEFAULT_RANGE });
LengthProperty.type = IntTypeRef;
NativeArray.addSymbol(LengthProperty);

const InsertFunction = new UCMethodSymbol({ name: toName('Insert'), range: DEFAULT_RANGE });
NativeArray.addSymbol(InsertFunction);

const IndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam.type = IntTypeRef;
InsertFunction.addSymbol(IndexParam);

const CountParam = new UCParamSymbol({ name: toName('Count'), range: DEFAULT_RANGE });
CountParam.type = IntTypeRef;
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

export const VectMethodLike = new UCMethodLikeSymbol(toName('Vect'));
VectMethodLike.returnType = VectorTypeRef;

const XParam = new UCParamSymbol({ name: toName('X'), range: DEFAULT_RANGE });
XParam.type = FloatTypeRef;
VectMethodLike.addSymbol(XParam);

const YParam = new UCParamSymbol({ name: toName('Y'), range: DEFAULT_RANGE });
YParam.type = FloatTypeRef;
VectMethodLike.addSymbol(YParam);

const ZParam = new UCParamSymbol({ name: toName('Z'), range: DEFAULT_RANGE });
ZParam.type = FloatTypeRef;
VectMethodLike.addSymbol(ZParam);

VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol(toName('Rot'));
RotMethodLike.returnType = RotatorTypeRef;

const PitchParam = new UCParamSymbol({ name: toName('Pitch'), range: DEFAULT_RANGE });
PitchParam.type = IntTypeRef;
RotMethodLike.addSymbol(PitchParam);

const YawParam = new UCParamSymbol({ name: toName('Yaw'), range: DEFAULT_RANGE });
YawParam.type = IntTypeRef;
RotMethodLike.addSymbol(YawParam);

const RollParam = new UCParamSymbol({ name: toName('Roll'), range: DEFAULT_RANGE });
RollParam.type = IntTypeRef;
RotMethodLike.addSymbol(RollParam);

RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol(toName('Rng'));
RngMethodLike.returnType = RangeTypeRef;

const MinParam = new UCParamSymbol({ name: toName('Min'), range: DEFAULT_RANGE });
MinParam.type = FloatTypeRef;
RngMethodLike.addSymbol(MinParam);

const MaxParam = new UCParamSymbol({ name: toName('Max'), range: DEFAULT_RANGE });
MaxParam.type = FloatTypeRef;
RngMethodLike.addSymbol(MaxParam);

RngMethodLike.params = [MinParam, MaxParam];

// FIXME? These aren't truly classes.
SymbolsTable.addSymbol(NativeMap);
SymbolsTable.addSymbol(NativeArray);

export const PredefinedByte = new UCNativeType(NAME_BYTE);
export const PredefinedFloat = new UCNativeType(NAME_FLOAT);
export const PredefinedInt = new UCNativeType(NAME_INT);
export const PredefinedString = new UCNativeType(NAME_STRING);
export const PredefinedName = new UCNativeType(NAME_NAME);
export const PredefinedBool = new UCNativeType(NAME_BOOL);
export const PredefinedPointer = new UCNativeType(NAME_POINTER);
export const PredefinedButton = new UCNativeType(NAME_BUTTON);

export const TypeCastMap: Readonly<WeakMap<Name, UCNativeType>> = new WeakMap([
	[NAME_BYTE, PredefinedByte],
	[NAME_FLOAT, PredefinedFloat],
	[NAME_INT, PredefinedInt],
	[NAME_STRING, PredefinedString],
	[NAME_NAME, PredefinedName],
	[NAME_BOOL, PredefinedBool],
	// Oddly... conversion to a button is actually valid!
	[NAME_BUTTON, PredefinedButton]
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

PackagesTable.addSymbol(CORE_PACKAGE);