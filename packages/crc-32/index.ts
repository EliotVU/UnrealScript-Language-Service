/*!
 * crc-32 (C) 2014-present SheetJS -- http://sheetjs.com
 *
 * The crc32 code is a modified copy of https://github.com/SheetJS/js-crc32.
 * The purpose is to optimize its hashing function to interpret characters case-insensitive,
 * -- so that we don't have to use toLowerCase(), which allocates a new string.
 */
function signed_crc_table() {
    let c = 0;
    const table = new Array(256);

    for (let n = 0; n != 256; ++n) {
        c = n;
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        c = ((c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1));
        table[n] = c;
    }

    return typeof Int32Array !== 'undefined' ? new Int32Array(table) : table;
}

const T = signed_crc_table();
export function crc32_str(str: string) {
    let C = 0xFFFF ^ -1;
    let i = 0;
    const L = str.length;
    let c, d;
    while (i < L) {
        c = str.charCodeAt(i++);
        // Interpret the char case-insensitive, this way we don't have to allocate a new string with toLowerCase()
        c |= (Number(c >= 65 && c <= 90) << 5);
        if (c < 0x80) {
            C = (C >>> 8) ^ T[(C ^ c) & 0xFF];
        } else if (c < 0x800) {
            C = (C >>> 8) ^ T[(C ^ (192 | ((c >> 6) & 31))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | (c & 63))) & 0xFF];
        } else if (c >= 0xD800 && c < 0xE000) {
            c = (c & 1023) + 64; d = str.charCodeAt(i++) & 1023;
            C = (C >>> 8) ^ T[(C ^ (240 | ((c >> 8) & 7))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | ((c >> 2) & 63))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | ((d >> 6) & 15) | ((c & 3) << 4))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | (d & 63))) & 0xFF];
        } else {
            C = (C >>> 8) ^ T[(C ^ (224 | ((c >> 12) & 15))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | ((c >> 6) & 63))) & 0xFF];
            C = (C >>> 8) ^ T[(C ^ (128 | (c & 63))) & 0xFF];
        }
    }
    return C ^ -1;
}