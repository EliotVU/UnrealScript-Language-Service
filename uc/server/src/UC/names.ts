import * as CRC32 from 'crc-32';

export class Name {
	static map = new Map<number, Name>();

	constructor(index: number, private text: string) {
		Name.map.set(index, this);
	}

	toString(): string {
		return this.text;
	}
}

export function toName(text: string): Name {
	const hash = CRC32.str(text.toLowerCase());
	return Name.map.get(hash) || new Name(hash, text);
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
export const NAME_REPLICATION = toName('Replication');
export const NAME_DEFAULTPROPERTIES = toName('DefaultProperties');
export const NAME_STRUCTDEFAULTPROPERTIES = toName('StructDefaultProperties');