import { ANTLRInputStream, IntStream } from 'antlr4ts';

export class CaseInsensitiveStream extends ANTLRInputStream {
	LA(i): number {
		if (i === 0)
			return 0;
		if (i < 0)
			++i;
		var idx = this.p + i - 1;
		if (idx >= this.n) {
			return IntStream.EOF;
		}
		return this.data[idx].toLowerCase().charCodeAt(0);
	}
}