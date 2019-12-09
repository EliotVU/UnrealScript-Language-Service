import { NAME_CLASS, NAME_ENUM, NAME_PACKAGE, NAME_PROPERTY, NAME_CORE, NAME_BYTEPROPERTY, NAME_INTPROPERTY, NAME_OBJECTPROPERTY, NAME_FLOATPROPERTY, NAME_NAMEPROPERTY, NAME_STRINGPROPERTY, NAME_STRPROPERTY, NAME_BOOLPROPERTY, NAME_POINTERPROPERTY, NAME_MAPPROPERTY, NAME_DELEGATEPROPERTY, NAME_ARRAYPROPERTY, NAME_CLASSPROPERTY } from '../names';
import { DEFAULT_RANGE, UCPackage, UCClassSymbol } from ".";
import { StaticObjectType } from './TypeSymbol';
import { addHashedSymbol } from './Package';

export const CORE_PACKAGE = new UCPackage(NAME_CORE);
addHashedSymbol(CORE_PACKAGE);

export const NativeProperty = new UCClassSymbol({ name: NAME_PROPERTY, range: DEFAULT_RANGE });
NativeProperty.extendsType = StaticObjectType;
NativeProperty.outer = CORE_PACKAGE;

export const NativeByteProperty = new UCClassSymbol({ name: NAME_BYTEPROPERTY, range: DEFAULT_RANGE });
NativeByteProperty.extendsType = StaticObjectType;
NativeByteProperty.outer = CORE_PACKAGE;

export const NativeFloatProperty = new UCClassSymbol({ name: NAME_FLOATPROPERTY, range: DEFAULT_RANGE });
NativeFloatProperty.extendsType = StaticObjectType;
NativeFloatProperty.outer = CORE_PACKAGE;

export const NativeIntProperty = new UCClassSymbol({ name: NAME_INTPROPERTY, range: DEFAULT_RANGE });
NativeIntProperty.extendsType = StaticObjectType;
NativeIntProperty.outer = CORE_PACKAGE;

export const NativeNameProperty = new UCClassSymbol({ name: NAME_NAMEPROPERTY, range: DEFAULT_RANGE });
NativeNameProperty.extendsType = StaticObjectType;
NativeNameProperty.outer = CORE_PACKAGE;

export const NativeStringProperty = new UCClassSymbol({ name: NAME_STRINGPROPERTY, range: DEFAULT_RANGE });
NativeStringProperty.extendsType = StaticObjectType;
NativeStringProperty.outer = CORE_PACKAGE;

export const NativeStrProperty = new UCClassSymbol({ name: NAME_STRPROPERTY, range: DEFAULT_RANGE });
NativeStrProperty.extendsType = StaticObjectType;
NativeStrProperty.outer = CORE_PACKAGE;

export const NativeBoolProperty = new UCClassSymbol({ name: NAME_BOOLPROPERTY, range: DEFAULT_RANGE });
NativeBoolProperty.extendsType = StaticObjectType;
NativeBoolProperty.outer = CORE_PACKAGE;

export const NativePointerProperty = new UCClassSymbol({ name: NAME_POINTERPROPERTY, range: DEFAULT_RANGE });
NativePointerProperty.extendsType = StaticObjectType;
NativePointerProperty.outer = CORE_PACKAGE;

export const NativeMapProperty = new UCClassSymbol({ name: NAME_MAPPROPERTY, range: DEFAULT_RANGE });
NativeMapProperty.extendsType = StaticObjectType;
NativeMapProperty.outer = CORE_PACKAGE;

export const NativeDelegateProperty = new UCClassSymbol({ name: NAME_DELEGATEPROPERTY, range: DEFAULT_RANGE });
NativeDelegateProperty.extendsType = StaticObjectType;
NativeDelegateProperty.outer = CORE_PACKAGE;

export const NativeArrayProperty = new UCClassSymbol({ name: NAME_ARRAYPROPERTY, range: DEFAULT_RANGE });
NativeArrayProperty.extendsType = StaticObjectType;
NativeArrayProperty.outer = CORE_PACKAGE;

export const NativeClassProperty = new UCClassSymbol({ name: NAME_CLASSPROPERTY, range: DEFAULT_RANGE });
NativeClassProperty.extendsType = StaticObjectType;
NativeClassProperty.outer = CORE_PACKAGE;

export const NativeObjectProperty = new UCClassSymbol({ name: NAME_OBJECTPROPERTY, range: DEFAULT_RANGE });
NativeObjectProperty.extendsType = StaticObjectType;
NativeObjectProperty.outer = CORE_PACKAGE;

export const NativePackage = new UCClassSymbol({ name: NAME_PACKAGE, range: DEFAULT_RANGE });
NativePackage.extendsType = StaticObjectType;
NativePackage.outer = CORE_PACKAGE;

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
NativeClass.extendsType = StaticObjectType;
NativeClass.outer = CORE_PACKAGE;

export const NativeEnum = new UCClassSymbol({ name: NAME_ENUM, range: DEFAULT_RANGE });
NativeEnum.extendsType = StaticObjectType;
NativeEnum.outer = CORE_PACKAGE;

addHashedSymbol(NativePackage);
addHashedSymbol(NativeClass);
addHashedSymbol(NativeEnum);
addHashedSymbol(NativeProperty);
addHashedSymbol(NativeByteProperty);
addHashedSymbol(NativeFloatProperty);
addHashedSymbol(NativeIntProperty);
addHashedSymbol(NativeNameProperty);
addHashedSymbol(NativeStringProperty);
addHashedSymbol(NativeStrProperty);
addHashedSymbol(NativeBoolProperty);
addHashedSymbol(NativePointerProperty);
addHashedSymbol(NativeMapProperty);
addHashedSymbol(NativeDelegateProperty);
addHashedSymbol(NativeArrayProperty);
addHashedSymbol(NativeClassProperty);
addHashedSymbol(NativeObjectProperty);