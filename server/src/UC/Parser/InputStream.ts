import { CharStream, CharStreamImpl } from 'antlr4ng';

export class UCInputStream extends CharStreamImpl {
    static fromString(text: string): UCInputStream {
        const stream = CharStream.fromString(text) as CharStreamImpl;
        Object.setPrototypeOf(stream, UCInputStream.prototype);
        return stream;
    }

    override LA(i: number): number {
        return (i = super.LA(i)) | (Number(i >= 65 && i <= 90) << 5);
    }
}
