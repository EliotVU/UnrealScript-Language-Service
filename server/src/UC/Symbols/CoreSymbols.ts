import {
    NAME_ARRAYPROPERTY,
    NAME_BOOLPROPERTY,
    NAME_BYTEPROPERTY,
    NAME_CLASS,
    NAME_CLASSPROPERTY,
    NAME_COMPONENTPROPERTY,
    NAME_CONST,
    NAME_CORE,
    NAME_DELEGATEPROPERTY,
    NAME_ENUM,
    NAME_FIELD,
    NAME_FLOATPROPERTY,
    NAME_FUNCTION,
    NAME_INTERFACE,
    NAME_INTERFACEPROPERTY,
    NAME_INTPROPERTY,
    NAME_MAPPROPERTY,
    NAME_NAME,
    NAME_NAMEPROPERTY,
    NAME_OBJECT,
    NAME_OBJECTPROPERTY,
    NAME_OUTER,
    NAME_PACKAGE,
    NAME_POINTERPROPERTY,
    NAME_PROPERTY,
    NAME_ROTATOR,
    NAME_SCRIPTSTRUCT,
    NAME_STATE,
    NAME_STRINGPROPERTY,
    NAME_STRPROPERTY,
    NAME_STRUCT,
    NAME_STRUCTPROPERTY,
    NAME_VECTOR,
} from '../names';
import {
    DEFAULT_RANGE,
    ModifierFlags,
    StaticNameType,
    StaticObjectType,
    StaticRotatorType,
    StaticVectorType,
    UCClassSymbol,
    UCPackage,
    UCPropertySymbol,
    UCScriptStructSymbol,
    addHashedSymbol
} from './';

export const CORE_PACKAGE = new UCPackage(NAME_CORE);

export const IntrinsicObject = new UCClassSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE });
IntrinsicObject.modifiers |= ModifierFlags.Native | ModifierFlags.Abstract;
IntrinsicObject.outer = CORE_PACKAGE;

export const IntrinsicVector = new UCScriptStructSymbol({ name: NAME_VECTOR, range: DEFAULT_RANGE });
IntrinsicVector.outer = IntrinsicObject;

export const IntrinsicRotator = new UCScriptStructSymbol({ name: NAME_ROTATOR, range: DEFAULT_RANGE });
IntrinsicRotator.outer = IntrinsicObject;

export const Object_OuterProperty = new UCPropertySymbol(
    { name: NAME_OUTER, range: DEFAULT_RANGE },
    DEFAULT_RANGE, StaticObjectType);
Object_OuterProperty.modifiers |= ModifierFlags.Native;
Object_OuterProperty.outer = IntrinsicObject;
IntrinsicObject.addSymbol(Object_OuterProperty);

export const Object_NameProperty = new UCPropertySymbol(
    { name: NAME_NAME, range: DEFAULT_RANGE },
    DEFAULT_RANGE, StaticNameType);
Object_NameProperty.modifiers |= ModifierFlags.Native;
Object_NameProperty.outer = IntrinsicObject;
IntrinsicObject.addSymbol(Object_NameProperty);

export const Object_ClassProperty = new UCPropertySymbol(
    { name: NAME_CLASS, range: DEFAULT_RANGE },
    DEFAULT_RANGE, StaticObjectType);
Object_ClassProperty.modifiers |= ModifierFlags.Native;
Object_ClassProperty.outer = IntrinsicObject;
IntrinsicObject.addSymbol(Object_ClassProperty);

export const IntrinsicField = new UCClassSymbol({ name: NAME_FIELD, range: DEFAULT_RANGE });
IntrinsicField.modifiers |= ModifierFlags.Intrinsic;
IntrinsicField.super = IntrinsicObject;
IntrinsicField.outer = CORE_PACKAGE;

export const IntrinsicConst = new UCClassSymbol({ name: NAME_CONST, range: DEFAULT_RANGE });
IntrinsicConst.modifiers |= ModifierFlags.Intrinsic;
IntrinsicConst.super = IntrinsicField;
IntrinsicConst.outer = CORE_PACKAGE;

export const IntrinsicEnum = new UCClassSymbol({ name: NAME_ENUM, range: DEFAULT_RANGE });
IntrinsicEnum.modifiers |= ModifierFlags.Intrinsic;
IntrinsicEnum.super = IntrinsicField;
IntrinsicEnum.outer = CORE_PACKAGE;

export const IntrinsicProperty = new UCClassSymbol({ name: NAME_PROPERTY, range: DEFAULT_RANGE });
IntrinsicProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicProperty.super = IntrinsicObject;
IntrinsicProperty.outer = CORE_PACKAGE;

export const IntrinsicObjectProperty = new UCClassSymbol({ name: NAME_OBJECTPROPERTY, range: DEFAULT_RANGE });
IntrinsicObjectProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicObjectProperty.super = IntrinsicProperty;
IntrinsicObjectProperty.outer = CORE_PACKAGE;

export const IntrinsicInterfaceProperty = new UCClassSymbol({ name: NAME_INTERFACEPROPERTY, range: DEFAULT_RANGE });
IntrinsicInterfaceProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicInterfaceProperty.super = IntrinsicProperty;
IntrinsicInterfaceProperty.outer = CORE_PACKAGE;

export const IntrinsicComponentProperty = new UCClassSymbol({ name: NAME_COMPONENTPROPERTY, range: DEFAULT_RANGE });
IntrinsicComponentProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicComponentProperty.super = IntrinsicObjectProperty;
IntrinsicComponentProperty.outer = CORE_PACKAGE;

export const IntrinsicClassProperty = new UCClassSymbol({ name: NAME_CLASSPROPERTY, range: DEFAULT_RANGE });
IntrinsicClassProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicClassProperty.super = IntrinsicObjectProperty;
IntrinsicClassProperty.outer = CORE_PACKAGE;

export const IntrinsicByteProperty = new UCClassSymbol({ name: NAME_BYTEPROPERTY, range: DEFAULT_RANGE });
IntrinsicByteProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicByteProperty.super = IntrinsicProperty;
IntrinsicByteProperty.outer = CORE_PACKAGE;

export const IntrinsicFloatProperty = new UCClassSymbol({ name: NAME_FLOATPROPERTY, range: DEFAULT_RANGE });
IntrinsicFloatProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicFloatProperty.super = IntrinsicProperty;
IntrinsicFloatProperty.outer = CORE_PACKAGE;

export const IntrinsicIntProperty = new UCClassSymbol({ name: NAME_INTPROPERTY, range: DEFAULT_RANGE });
IntrinsicIntProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicIntProperty.super = IntrinsicProperty;
IntrinsicIntProperty.outer = CORE_PACKAGE;

export const IntrinsicNameProperty = new UCClassSymbol({ name: NAME_NAMEPROPERTY, range: DEFAULT_RANGE });
IntrinsicNameProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicNameProperty.super = IntrinsicProperty;
IntrinsicNameProperty.outer = CORE_PACKAGE;

export const IntrinsicStringProperty = new UCClassSymbol({ name: NAME_STRINGPROPERTY, range: DEFAULT_RANGE });
IntrinsicStringProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicStringProperty.super = IntrinsicProperty;
IntrinsicStringProperty.outer = CORE_PACKAGE;

export const IntrinsicStrProperty = new UCClassSymbol({ name: NAME_STRPROPERTY, range: DEFAULT_RANGE });
IntrinsicStrProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicStrProperty.super = IntrinsicProperty;
IntrinsicStrProperty.outer = CORE_PACKAGE;

export const IntrinsicStructProperty = new UCClassSymbol({ name: NAME_STRUCTPROPERTY, range: DEFAULT_RANGE });
IntrinsicStructProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicStructProperty.extendsType = StaticObjectType;
IntrinsicStructProperty.outer = CORE_PACKAGE;

export const IntrinsicBoolProperty = new UCClassSymbol({ name: NAME_BOOLPROPERTY, range: DEFAULT_RANGE });
IntrinsicBoolProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicBoolProperty.super = IntrinsicProperty;
IntrinsicBoolProperty.outer = CORE_PACKAGE;

export const IntrinsicPointerProperty = new UCClassSymbol({ name: NAME_POINTERPROPERTY, range: DEFAULT_RANGE });
IntrinsicPointerProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicPointerProperty.super = IntrinsicProperty;
IntrinsicPointerProperty.outer = CORE_PACKAGE;

export const IntrinsicMapProperty = new UCClassSymbol({ name: NAME_MAPPROPERTY, range: DEFAULT_RANGE });
IntrinsicMapProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicMapProperty.super = IntrinsicProperty;
IntrinsicMapProperty.outer = CORE_PACKAGE;

export const IntrinsicDelegateProperty = new UCClassSymbol({ name: NAME_DELEGATEPROPERTY, range: DEFAULT_RANGE });
IntrinsicDelegateProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicDelegateProperty.super = IntrinsicProperty;
IntrinsicDelegateProperty.outer = CORE_PACKAGE;

export const IntrinsicArrayProperty = new UCClassSymbol({ name: NAME_ARRAYPROPERTY, range: DEFAULT_RANGE });
IntrinsicArrayProperty.modifiers |= ModifierFlags.Intrinsic;
IntrinsicArrayProperty.super = IntrinsicProperty;
IntrinsicArrayProperty.outer = CORE_PACKAGE;

export const IntrinsicStruct = new UCClassSymbol({ name: NAME_STRUCT, range: DEFAULT_RANGE });
IntrinsicStruct.modifiers |= ModifierFlags.Intrinsic;
IntrinsicStruct.super = IntrinsicField;
IntrinsicStruct.outer = CORE_PACKAGE;

export const IntrinsicFunction = new UCClassSymbol({ name: NAME_FUNCTION, range: DEFAULT_RANGE });
IntrinsicFunction.modifiers |= ModifierFlags.Intrinsic;
IntrinsicFunction.super = IntrinsicStruct;
IntrinsicFunction.outer = CORE_PACKAGE;

export const IntrinsicScriptStruct = new UCClassSymbol({ name: NAME_SCRIPTSTRUCT, range: DEFAULT_RANGE });
IntrinsicScriptStruct.modifiers |= ModifierFlags.Intrinsic;
IntrinsicScriptStruct.super = IntrinsicStruct;
IntrinsicScriptStruct.outer = CORE_PACKAGE;

export const IntrinsicState = new UCClassSymbol({ name: NAME_STATE, range: DEFAULT_RANGE });
IntrinsicState.modifiers |= ModifierFlags.Intrinsic;
IntrinsicState.super = IntrinsicStruct;
IntrinsicState.outer = CORE_PACKAGE;

// A Class type instance has all the members of an object.
export const IntrinsicClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
IntrinsicClass.modifiers |= ModifierFlags.Intrinsic;
IntrinsicClass.super = IntrinsicState;
IntrinsicClass.outer = CORE_PACKAGE;

export const IntrinsicInterface = new UCClassSymbol({ name: NAME_INTERFACE, range: DEFAULT_RANGE });
IntrinsicInterface.modifiers |= ModifierFlags.Native;
IntrinsicInterface.super = IntrinsicObject;
IntrinsicInterface.outer = CORE_PACKAGE;

export const IntrinsicPackage = new UCClassSymbol({ name: NAME_PACKAGE, range: DEFAULT_RANGE });
IntrinsicPackage.modifiers |= ModifierFlags.Intrinsic;
IntrinsicPackage.super = IntrinsicObject;
IntrinsicPackage.outer = CORE_PACKAGE;

addHashedSymbol(CORE_PACKAGE);
// addHashedSymbol(IntrinsicObject);
/*----*/addHashedSymbol(IntrinsicField);
/*--------*/addHashedSymbol(IntrinsicConst);
/*--------*/addHashedSymbol(IntrinsicEnum);
/*--------*/addHashedSymbol(IntrinsicProperty);
/*------------*/addHashedSymbol(IntrinsicByteProperty);
/*------------*/addHashedSymbol(IntrinsicFloatProperty);
/*------------*/addHashedSymbol(IntrinsicIntProperty);
/*------------*/addHashedSymbol(IntrinsicNameProperty);
/*------------*/addHashedSymbol(IntrinsicStringProperty);
/*------------*/addHashedSymbol(IntrinsicStrProperty);
/*------------*/addHashedSymbol(IntrinsicStructProperty);
/*------------*/addHashedSymbol(IntrinsicBoolProperty);
/*------------*/addHashedSymbol(IntrinsicPointerProperty);
/*------------*/addHashedSymbol(IntrinsicMapProperty);
/*------------*/addHashedSymbol(IntrinsicDelegateProperty);
/*------------*/addHashedSymbol(IntrinsicArrayProperty);
/*------------*/addHashedSymbol(IntrinsicObjectProperty);
/*----------------*/addHashedSymbol(IntrinsicComponentProperty);
/*----------------*/addHashedSymbol(IntrinsicClassProperty);
/*------------*/addHashedSymbol(IntrinsicInterfaceProperty);
/*--------*/addHashedSymbol(IntrinsicStruct);
/*------------*/addHashedSymbol(IntrinsicFunction);
/*------------*/addHashedSymbol(IntrinsicScriptStruct);
/*------------*/addHashedSymbol(IntrinsicState);
/*----------------*/addHashedSymbol(IntrinsicClass);
/*----*/// addHashedSymbol(IntrinsicInterface);
/*----*/addHashedSymbol(IntrinsicPackage);

StaticVectorType.setRefNoIndex(IntrinsicVector);
StaticRotatorType.setRefNoIndex(IntrinsicRotator);
// StaticRangeType.setRefNoIndex(IntrinsicRange);
