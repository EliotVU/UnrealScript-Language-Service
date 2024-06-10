import { Token } from 'antlr4ng';

export function createToken(text: string): Token {
    return { text } as Token;
}
