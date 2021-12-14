import { ANTLRInputStream } from 'antlr4ts';

export class CaseInsensitiveStream extends ANTLRInputStream {
	LA(i: number): number {
		const c = super.LA(i);
        return c | (Number(c >= 65 && c <= 90) << 5);
	}
}