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

export const NAME_NONE = toName('none');
export const NAME_NAME = toName('name');
export const NAME_ARRAY = toName('Array');
export const NAME_CLASS = toName('Class');
export const NAME_REPLICATION = toName('replication');
export const NAME_DEFAULTPROPERTIES = toName('defaultproperties');
export const NAME_STRUCTDEFAULTPROPERTIES = toName('structdefaultproperties');