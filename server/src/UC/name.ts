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