import { crc32_str } from './hash';

export type NameHash = number;
export type Name = Readonly<{
    hash: NameHash;
    text: string;
}>;

const namesMap = new Map<NameHash, Name>();

export function toName(text: Readonly<string>): Name {
    // console.assert(text.length <= 1024, 'LONG STRING', text); // Max 64 in UE2
    const hash = crc32_str(text);
    let name = namesMap.get(hash);
    if (name !== undefined) {
        return name;
    }

    name = { hash, text };
    namesMap.set(hash, name);
    return name;
}

export function clearNames(): void {
    namesMap.clear();
}