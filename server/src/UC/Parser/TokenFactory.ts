import { Token } from 'antlr4ts';

export function createToken(text: string): Token {
    return { text } as Token;
}
