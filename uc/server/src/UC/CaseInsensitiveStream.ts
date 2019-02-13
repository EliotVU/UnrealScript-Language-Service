import { ANTLRInputStream } from 'antlr4ts';

export class CaseInsensitiveStream extends ANTLRInputStream {
	LA(i: number): number {
		const c = super.LA(i);
		if (c <= 0) {
			return c;
		}
		// return String.fromCodePoint(c).toLowerCase().charCodeAt(0);
		return (c >= 65 && c <= 90) ? (97 + c - 65) : c;

		// if (i === 0)
		// 	return 0;
		// if (i < 0)
		// 	++i;
		// var idx = this.p + i - 1;
		// if (idx >= this.n) {
		// 	return IntStream.EOF;
		// }
		// return this.data[idx].toLowerCase().charCodeAt(0);
	}
}