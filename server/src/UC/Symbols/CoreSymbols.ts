import {
    NAME_ARRAYPROPERTY, NAME_BOOLPROPERTY, NAME_BYTEPROPERTY, NAME_CLASS, NAME_CLASSPROPERTY,
    NAME_COMPONENTPROPERTY, NAME_CONST, NAME_CORE, NAME_DELEGATEPROPERTY, NAME_ENUM, NAME_FIELD,
    NAME_FLOATPROPERTY, NAME_FUNCTION, NAME_INTERFACE, NAME_INTERFACEPROPERTY, NAME_INTPROPERTY,
    NAME_MAPPROPERTY, NAME_NAME, NAME_NAMEPROPERTY, NAME_OBJECT, NAME_OBJECTPROPERTY, NAME_OUTER,
    NAME_PACKAGE, NAME_POINTERPROPERTY, NAME_PROPERTY, NAME_SCRIPTSTRUCT, NAME_STATE,
    NAME_STRINGPROPERTY, NAME_STRPROPERTY, NAME_STRUCT, NAME_STRUCTPROPERTY
} from '../names';
import { DEFAULT_RANGE, FieldModifiers, UCClassSymbol, UCPackage, UCPropertySymbol } from './';
import { addHashedSymbol } from './Package';
import { StaticNameType, StaticObjectType } from './TypeSymbol';

export const CORE_PACKAGE = new UCPackage(NAME_CORE);
addHashedSymbol(CORE_PACKAGE);

export const NativeObject = new UCClassSymbol({ name: NAME_OBJECT, range: DEFAULT_RANGE });
NativeObject.modifiers |= FieldModifiers.Native;
NativeObject.extendsType = StaticObjectType;
NativeObject.outer = CORE_PACKAGE;

export const OuterProperty = new UCPropertySymbol({ name: NAME_OUTER, range: DEFAULT_RANGE });
OuterProperty.modifiers |= FieldModifiers.Native;
OuterProperty.type = StaticObjectType;
OuterProperty.outer = NativeObject;

export const NameProperty = new UCPropertySymbol({ name: NAME_NAME, range: DEFAULT_RANGE });
NameProperty.modifiers |= FieldModifiers.Native;
NameProperty.type = StaticNameType;
NameProperty.outer = NativeObject;

export const ClassProperty = new UCPropertySymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
ClassProperty.modifiers |= FieldModifiers.Native;
ClassProperty.type = StaticObjectType;
ClassProperty.outer = NativeObject;

export const NativeField = new UCClassSymbol({ name: NAME_FIELD, range: DEFAULT_RANGE });
NativeField.modifiers |= FieldModifiers.Native;
NativeField.extendsType = StaticObjectType;
NativeField.outer = CORE_PACKAGE;

export const NativeConst = new UCClassSymbol({ name: NAME_CONST, range: DEFAULT_RANGE });
NativeConst.modifiers |= FieldModifiers.Native;
NativeConst.extendsType = StaticObjectType;
NativeConst.outer = CORE_PACKAGE;

export const NativeEnum = new UCClassSymbol({ name: NAME_ENUM, range: DEFAULT_RANGE });
NativeEnum.modifiers |= FieldModifiers.Native;
NativeEnum.extendsType = StaticObjectType;
NativeEnum.outer = CORE_PACKAGE;

export const NativeProperty = new UCClassSymbol({ name: NAME_PROPERTY, range: DEFAULT_RANGE });
NativeProperty.modifiers |= FieldModifiers.Native;
NativeProperty.extendsType = StaticObjectType;
NativeProperty.outer = CORE_PACKAGE;

export const NativeByteProperty = new UCClassSymbol({ name: NAME_BYTEPROPERTY, range: DEFAULT_RANGE });
NativeByteProperty.modifiers |= FieldModifiers.Native;
NativeByteProperty.extendsType = StaticObjectType;
NativeByteProperty.outer = CORE_PACKAGE;

export const NativeInterfaceProperty = new UCClassSymbol({ name: NAME_INTERFACEPROPERTY, range: DEFAULT_RANGE });
NativeInterfaceProperty.modifiers |= FieldModifiers.Native;
NativeInterfaceProperty.extendsType = StaticObjectType;
NativeInterfaceProperty.outer = CORE_PACKAGE;

export const NativeFloatProperty = new UCClassSymbol({ name: NAME_FLOATPROPERTY, range: DEFAULT_RANGE });
NativeFloatProperty.modifiers |= FieldModifiers.Native;
NativeFloatProperty.extendsType = StaticObjectType;
NativeFloatProperty.outer = CORE_PACKAGE;

export const NativeIntProperty = new UCClassSymbol({ name: NAME_INTPROPERTY, range: DEFAULT_RANGE });
NativeIntProperty.modifiers |= FieldModifiers.Native;
NativeIntProperty.extendsType = StaticObjectType;
NativeIntProperty.outer = CORE_PACKAGE;

export const NativeNameProperty = new UCClassSymbol({ name: NAME_NAMEPROPERTY, range: DEFAULT_RANGE });
NativeNameProperty.modifiers |= FieldModifiers.Native;
NativeNameProperty.extendsType = StaticObjectType;
NativeNameProperty.outer = CORE_PACKAGE;

export const NativeStringProperty = new UCClassSymbol({ name: NAME_STRINGPROPERTY, range: DEFAULT_RANGE });
NativeStringProperty.modifiers |= FieldModifiers.Native;
NativeStringProperty.extendsType = StaticObjectType;
NativeStringProperty.outer = CORE_PACKAGE;

export const NativeStrProperty = new UCClassSymbol({ name: NAME_STRPROPERTY, range: DEFAULT_RANGE });
NativeStrProperty.modifiers |= FieldModifiers.Native;
NativeStrProperty.extendsType = StaticObjectType;
NativeStrProperty.outer = CORE_PACKAGE;

export const NativeStructProperty = new UCClassSymbol({ name: NAME_STRUCTPROPERTY, range: DEFAULT_RANGE });
NativeStructProperty.modifiers |= FieldModifiers.Native;
NativeStructProperty.extendsType = StaticObjectType;
NativeStructProperty.outer = CORE_PACKAGE;

export const NativeBoolProperty = new UCClassSymbol({ name: NAME_BOOLPROPERTY, range: DEFAULT_RANGE });
NativeBoolProperty.modifiers |= FieldModifiers.Native;
NativeBoolProperty.extendsType = StaticObjectType;
NativeBoolProperty.outer = CORE_PACKAGE;

export const NativePointerProperty = new UCClassSymbol({ name: NAME_POINTERPROPERTY, range: DEFAULT_RANGE });
NativePointerProperty.modifiers |= FieldModifiers.Native;
NativePointerProperty.extendsType = StaticObjectType;
NativePointerProperty.outer = CORE_PACKAGE;

export const NativeMapProperty = new UCClassSymbol({ name: NAME_MAPPROPERTY, range: DEFAULT_RANGE });
NativeMapProperty.modifiers |= FieldModifiers.Native;
NativeMapProperty.extendsType = StaticObjectType;
NativeMapProperty.outer = CORE_PACKAGE;

export const NativeDelegateProperty = new UCClassSymbol({ name: NAME_DELEGATEPROPERTY, range: DEFAULT_RANGE });
NativeDelegateProperty.modifiers |= FieldModifiers.Native;
NativeDelegateProperty.extendsType = StaticObjectType;
NativeDelegateProperty.outer = CORE_PACKAGE;

export const NativeArrayProperty = new UCClassSymbol({ name: NAME_ARRAYPROPERTY, range: DEFAULT_RANGE });
NativeArrayProperty.modifiers |= FieldModifiers.Native;
NativeArrayProperty.extendsType = StaticObjectType;
NativeArrayProperty.outer = CORE_PACKAGE;

export const NativeObjectProperty = new UCClassSymbol({ name: NAME_OBJECTPROPERTY, range: DEFAULT_RANGE });
NativeObjectProperty.modifiers |= FieldModifiers.Native;
NativeObjectProperty.extendsType = StaticObjectType;
NativeObjectProperty.outer = CORE_PACKAGE;

export const NativeComponentProperty = new UCClassSymbol({ name: NAME_COMPONENTPROPERTY, range: DEFAULT_RANGE });
NativeComponentProperty.modifiers |= FieldModifiers.Native;
NativeComponentProperty.extendsType = StaticObjectType;
NativeComponentProperty.outer = CORE_PACKAGE;

export const NativeClassProperty = new UCClassSymbol({ name: NAME_CLASSPROPERTY, range: DEFAULT_RANGE });
NativeClassProperty.modifiers |= FieldModifiers.Native;
NativeClassProperty.extendsType = StaticObjectType;
NativeClassProperty.outer = CORE_PACKAGE;

export const NativeStruct = new UCClassSymbol({ name: NAME_STRUCT, range: DEFAULT_RANGE });
NativeStruct.modifiers |= FieldModifiers.Native;
NativeStruct.extendsType = StaticObjectType;
NativeStruct.outer = CORE_PACKAGE;

export const NativeFunction = new UCClassSymbol({ name: NAME_FUNCTION, range: DEFAULT_RANGE });
NativeFunction.modifiers |= FieldModifiers.Native;
NativeFunction.extendsType = StaticObjectType;
NativeFunction.outer = CORE_PACKAGE;

export const NativeScriptStruct = new UCClassSymbol({ name: NAME_SCRIPTSTRUCT, range: DEFAULT_RANGE });
NativeScriptStruct.modifiers |= FieldModifiers.Native;
NativeScriptStruct.extendsType = StaticObjectType;
NativeScriptStruct.outer = CORE_PACKAGE;

export const NativeState = new UCClassSymbol({ name: NAME_STATE, range: DEFAULT_RANGE });
NativeState.modifiers |= FieldModifiers.Native;
NativeState.extendsType = StaticObjectType;
NativeState.outer = CORE_PACKAGE;

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
NativeClass.modifiers |= FieldModifiers.Native;
NativeClass.extendsType = StaticObjectType;
NativeClass.outer = CORE_PACKAGE;

export const NativeInterface = new UCClassSymbol({ name: NAME_INTERFACE, range: DEFAULT_RANGE });
NativeInterface.modifiers |= FieldModifiers.Native;
NativeInterface.extendsType = StaticObjectType;
NativeInterface.outer = CORE_PACKAGE;

export const NativePackage = new UCClassSymbol({ name: NAME_PACKAGE, range: DEFAULT_RANGE });
NativePackage.modifiers |= FieldModifiers.Native;
NativePackage.extendsType = StaticObjectType;
NativePackage.outer = CORE_PACKAGE;

// addHashedSymbol(NativeObject);
    addHashedSymbol(NativeField);
        addHashedSymbol(NativeConst);
        addHashedSymbol(NativeEnum);
        addHashedSymbol(NativeProperty);
            addHashedSymbol(NativeByteProperty);
            addHashedSymbol(NativeInterfaceProperty);
            addHashedSymbol(NativeFloatProperty);
            addHashedSymbol(NativeIntProperty);
            addHashedSymbol(NativeNameProperty);
            addHashedSymbol(NativeStringProperty);
            addHashedSymbol(NativeStrProperty);
            addHashedSymbol(NativeStructProperty);
            addHashedSymbol(NativeBoolProperty);
            addHashedSymbol(NativePointerProperty);
            addHashedSymbol(NativeMapProperty);
            addHashedSymbol(NativeDelegateProperty);
            addHashedSymbol(NativeArrayProperty);
            addHashedSymbol(NativeObjectProperty);
            addHashedSymbol(NativeClassProperty);
            addHashedSymbol(NativeComponentProperty);
        addHashedSymbol(NativeStruct);
            addHashedSymbol(NativeScriptStruct);
            addHashedSymbol(NativeState);
                addHashedSymbol(NativeClass);
    // addHashedSymbol(NativeInterface);
    addHashedSymbol(NativePackage);
