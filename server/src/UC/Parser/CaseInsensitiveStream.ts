import { ANTLRInputStream } from 'antlr4ts';

export class CaseInsensitiveStream extends ANTLRInputStream {
	LA(i: number): number {
		const c = super.LA(i);
		// return String.fromCodePoint(c).toLowerCase().charCodeAt(0);
		return (c >= 65 && c <= 90) ? (97 + c - 65) : c;
	}
}