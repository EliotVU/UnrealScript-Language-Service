import { CharStreams, CodePointCharStream } from 'antlr4ts';

export class UCInputStream extends CodePointCharStream {
    static fromString(text: string): UCInputStream {
        const stream = CharStreams.fromString(text);
        Object.setPrototypeOf(stream, UCInputStream.prototype);
        return stream;
    }

	override LA(i: number): number {
		const c = super.LA(i);
        return c | (Number(c >= 65 && c <= 90) << 5);
	}
}