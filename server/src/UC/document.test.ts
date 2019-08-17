import * as path from 'path';

import { expect } from 'chai';

import { MacroContext, MacroCallContext } from '../antlr/UCPreprocessorParser';

import { UCDocument } from './document';
import { TRANSIENT_PACKAGE } from './Symbols';

const GRAMMARS_DIR = path.resolve(__dirname, '../../../grammars/examples');

describe('Document with macros', () => {
	const document = new UCDocument(path.join(GRAMMARS_DIR, 'macro.uci'), TRANSIENT_PACKAGE);
	document.build();
	if (document.macroTree && document.macroTree.children) {
		for (var macro of document.macroTree.children) {
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
	document.link();

	it('No diagnostics?', () => {
		const diagnostics = document.analyze();
		expect(diagnostics.length).to.equal(0);
	});

	it('document name', () => {
		expect(document.fileName).to.equal('macro.uci');
	});
});