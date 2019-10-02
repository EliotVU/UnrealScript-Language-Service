import { CommonTokenStream, Token, WritableToken, ANTLRErrorListener } from 'antlr4ts';

import { CaseInsensitiveStream } from './CaseInsensitiveStream';

import { MacroProgramContext, MacroCallContext } from '../../antlr/UCPreprocessorParser';
import { UCLexer } from '../../antlr/UCLexer';

export interface TokenExt extends WritableToken {
	length: number;
}

export class CommonTokenStreamExt extends CommonTokenStream {
	readonly evaluatedTokens = new Map<number, TokenExt[]>();

	initMacroTree(macroTree: MacroProgramContext, errListener: ANTLRErrorListener<number>) {
		const smNodes = macroTree.macroStatement();
		for (let smNode of smNodes) {
			const macroCtx = smNode.macro();
			if (macroCtx.isActive && macroCtx instanceof MacroCallContext) {
				// TODO: Cache the evaluated tokens from within the `define context itself,
				// -- so that we don't have to repeat this step for each macro call.
				let tokens = macroCtx.evaluatedTokens;
				if (!tokens) {
					const value = macroCtx._expr.value.toString();
					if (value === '...') {
						// stumbled on an empty definition.
						continue;
					}
					const rawText = value.replace('\\', '');
					const rawLexer = new UCLexer(new CaseInsensitiveStream(rawText));
					rawLexer.removeErrorListeners(); rawLexer.addErrorListener(errListener);
					tokens = rawLexer.getAllTokens();
					macroCtx.evaluatedTokens = tokens;
				}

				if (tokens) {
					const token = smNode.MACRO_CHAR();
					this.evaluatedTokens.set(token.symbol.startIndex, tokens as TokenExt[]);
				}
			}
		}
	}

	fetch(n: number) {
		if (this.fetchedEOF) {
			return 0;
		}
		for (let i = 0; i < n; i++) {
			let token = this.tokenSource.nextToken() as TokenExt;

			// See if we have any evaluated tokens for this macro call.
			// if so, insert a token references to the evaluated tokens that are part of a "`define" text block.
			if (token.type === UCLexer.MACRO_CHAR) {
				const macroTokens = this.evaluatedTokens.get(token.startIndex);
				if (macroTokens) {
					const baseline = macroTokens[0].line;
					const basechar = macroTokens[0].charPositionInLine;
					for (let j = 0; j < macroTokens.length; ++j) {
						const macroToken = macroTokens[j];
						macroToken.tokenIndex = i + j;
						macroToken.line = token.line + (macroToken.line - baseline);
						macroToken.charPositionInLine = token.charPositionInLine;//token.charPositionInLine + (macroToken.charPositionInLine - basechar);
						macroToken.length = 1;
					}
					this.tokens.push(...macroTokens);
					n += macroTokens.length;
				}
			}

			token.tokenIndex = this.tokens.length;
			token.length = token.text ? token.text.length : 0;
			this.tokens.push(token);

			if (token.type === Token.EOF) {
				this.fetchedEOF = true;
				return i + 1;
			}
		}
		return n;
	}
}
