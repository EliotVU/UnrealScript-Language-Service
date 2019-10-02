import * as path from 'path';

import { expect } from 'chai';

import { ANTLRErrorListener } from 'antlr4ts';
import { MacroContext, MacroCallContext } from '../antlr/UCPreprocessorParser';
import { UCLexer } from '../antlr/UCLexer';

import { UCDocument } from './document';
import { TRANSIENT_PACKAGE } from './Symbols';
import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';

const GRAMMARS_DIR = path.resolve(__dirname, '../../../grammars/examples');

describe('Document with macros', () => {
	const document = new UCDocument(path.join(GRAMMARS_DIR, 'macro.uci'), TRANSIENT_PACKAGE);

	const inputStream = new CaseInsensitiveStream(document.readText());
	const lexer = new UCLexer(inputStream);

	const macroTree = document.preprocess(lexer);
	if (macroTree && macroTree.children) {
		for (var macro of macroTree.children) {
			console.debug('macro', macro.toStringTree());

			if (macro instanceof MacroContext) {
				let isActive = macro.isActive;
				console.debug('isActive:', isActive);

				if (macro instanceof MacroCallContext) {
					let id = macro._expr;
					console.debug('value:', id && id.value);
				}
			}
		}
	}

	it('No diagnostics?', () => {
		document.build();
		document.link();

		const diagnostics = document.analyze();
		expect(diagnostics.length).to.equal(0);
	});

	it('document name', () => {
		expect(document.fileName).to.equal('macro.uci');
	});
});