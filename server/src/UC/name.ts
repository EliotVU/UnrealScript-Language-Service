import { crc32_str } from './hash';

export type NameHash = number;
export type Name = Readonly<{
    hash: NameHash;
    text: string;
}>;

const namesMap = new Map<NameHash, Name>();

export function toName(text: Readonly<string>): Name {
    const hash = crc32_str(text);
    // console.assert(text.length <= 1024, 'LONG STRING', text); // Max 64 in UE2
    if (namesMap.has(hash)) {
        return namesMap.get(hash)!;
    }
    const name: Name = { hash, text };
    namesMap.set(hash, name);
    return name;
}