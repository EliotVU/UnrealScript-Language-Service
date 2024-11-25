import { CommonTokenStream, Token } from 'antlr4ts';

import { UCLexer } from '../antlr/generated/UCLexer';

export class UCTokenStream extends CommonTokenStream {
    public fetchHeaderComment(token: Token): Token | Token[] | undefined {
        let comments: Token[] | undefined;

        let precedingLine = token.line - 1;
        const pos = token.charPositionInLine;
        let i = token.tokenIndex;
        for (; --i >= 0;) {
            token = this.get(i);
            // Stop at the first /* */ comment
            // only if we are not actively looking for preceding // comments
            // note that a block comment may span several lines!
            if (token.type === UCLexer.BLOCK_COMMENT
                && typeof comments === 'undefined'
                && token.charPositionInLine === pos) {
                return token;
            }

            if (token.line < precedingLine) {
                break;
            }

            if (token.channel === UCLexer.COMMENTS_CHANNEL) {
                // Let's not pickup comments that start after trailing spaces, or after a preceding declaration.
                if (token.charPositionInLine !== pos) {
                    break;
                }

                if (comments === undefined) {
                    comments = [];
                }
                comments.push(token);

                // Look for more comments starting with '//' directly the last comment.
                --precedingLine;
                continue;
            }
        }

        return comments;
    }

    public fetchLeadingComment(token: Token): Token | undefined {
        let i = token.tokenIndex;
        const leadingLine = token.line;
        do {
            this.sync(++i);
            if (i >= this.tokens.length)
                break;
            token = this.tokens[i];
        } while (token.channel !== UCLexer.COMMENTS_CHANNEL && token.line === leadingLine);

        return token;
    }
}

export function commentTokensToStrings(comment: Token | Token[]): string[] {
    function stripLine(line: string): string {
        if (line.startsWith('//')) {
            return line.substring(2).trimStart();
        }

        return line;
    }

    if (Array.isArray(comment)) {
        return comment
            .map(token => stripLine(token.text!))
            .reverse();
    }

    // Simple stripping of a /* comment */ block
    const commentStr = comment.text!;
    if (commentStr.startsWith('/*')) {
        // Safe to assume that we are working with a string that ends with */
        const stripped = commentStr.startsWith('/**')
            ? commentStr.substring(3, commentStr.length - 2)
            : commentStr.substring(2, commentStr.length - 2);

        return stripped
            .split('\n')
            // Strip the leading indention
            .map(line => line.trimStart())
            .map(line => {
                if (line.startsWith('*')) {
                    return line.substring(1);
                }

                return line;
            })
            .filter(line => line.length > 0);
    }

    return [stripLine(commentStr)];
}
