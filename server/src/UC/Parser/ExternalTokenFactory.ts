import { type CharStream, CommonToken, CommonTokenFactory, type TokenSource, type WritableToken } from 'antlr4ts';

// TODO: Preserve a copy of the origin information.
export type ExternalToken = WritableToken & {
    externalLine: number;
    externalColumn: number;
    externalSource?: string; // Hash?
};

export class ExternalTokenFactory extends CommonTokenFactory {
    override create(
        source: { source?: TokenSource; stream?: CharStream; },
        type: number,
        text: string | undefined,
        channel: number,
        start: number,
        stop: number,
        line: number,
        charPositionInLine: number
    ): CommonToken {
        const t = new CommonToken(type, text, source, channel, start, stop) as unknown as ExternalToken;
        t.line = line;
        t.charPositionInLine = charPositionInLine;
        t.externalLine = t.line;
        t.externalColumn = t.charPositionInLine;
        t.externalSource = undefined; // pre-define

        return t as unknown as CommonToken;
    }
}
