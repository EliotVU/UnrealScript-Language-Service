import * as CRC32 from 'crc-32';

const namesMap = new Map<number, Name>();

export class Name {
	constructor(public readonly hash: number, private text: string) {
		namesMap.set(hash, this);
	}

	toString(): string {
		return this.text;
	}
}

export function toName(text: string): Name {
	const hash = CRC32.str(text.toLowerCase());
	// console.assert(text.length <= 1024, 'LONG STRING', text); // Max 64 in UE2
	return namesMap.get(hash) || new Name(hash, text);
}

export function toHash(text: string): number {
	return CRC32.str(text.toLowerCase());
}

export const NAME_NONE = toName('None');
export const NAME_BYTE = toName('Byte');
export const NAME_FLOAT = toName('Float');
export const NAME_INT = toName('Int');
export const NAME_STRING = toName('String');
export const NAME_NAME = toName('Name');
export const NAME_BOOL = toName('Bool');
export const NAME_POINTER = toName('Pointer');
export const NAME_MAP = toName('Map');
export const NAME_DELEGATE = toName('Delegate');
export const NAME_BUTTON = toName('Button');
export const NAME_ARRAY = toName('Array');
export const NAME_CLASS = toName('Class');
export const NAME_ENUM = toName('Enum');
export const NAME_ENUMCOUNT = toName('EnumCount');
export const NAME_STRUCT = toName('Struct');
export const NAME_STATE = toName('State');
export const NAME_PACKAGE = toName('Package');

export const NAME_VECTOR = toName('Vector');
export const NAME_ROTATOR = toName('Rotator');
export const NAME_RANGE = toName('Range');

export const NAME_CORE = toName('Core');
export const NAME_ENGINE = toName('Engine');

export const NAME_OBJECT = toName('Object');
export const NAME_PROPERTY = toName('Property');
export const NAME_BYTEPROPERTY = toName('ByteProperty');
export const NAME_FLOATPROPERTY = toName('FloatProperty');
export const NAME_INTPROPERTY = toName('IntProperty');
export const NAME_NAMEPROPERTY = toName('NameProperty');
export const NAME_STRINGPROPERTY = toName('StringProperty');
export const NAME_STRPROPERTY = toName('StrProperty');
export const NAME_BOOLPROPERTY = toName('BoolProperty');
export const NAME_POINTERPROPERTY = toName('PointerProperty');
export const NAME_MAPPROPERTY = toName('MapProperty');
export const NAME_DELEGATEPROPERTY = toName('DelegateProperty');
export const NAME_ARRAYPROPERTY = toName('ArrayProperty');
export const NAME_CLASSPROPERTY = toName('ClassProperty');
export const NAME_OBJECTPROPERTY = toName('ObjectProperty');
export const NAME_ACTOR = toName('Actor');

export const NAME_DEFAULT = toName('Default');
export const NAME_REPLICATION = toName('Replication');
export const NAME_DEFAULTPROPERTIES = toName('DefaultProperties');
export const NAME_STRUCTDEFAULTPROPERTIES = toName('StructDefaultProperties');

export const NAME_RETURNVALUE = toName('ReturnValue');
export const NAME_SPAWN = toName('Spawn');