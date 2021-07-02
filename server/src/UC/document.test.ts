import { expect } from 'chai';
import * as path from 'path';

import { UCLexer } from './antlr/generated/UCLexer';
import { createPreprocessor, preprocessDocument, UCDocument } from './document';
import { applyMacroSymbols, indexDocument } from './indexer';
import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';
import { TRANSIENT_PACKAGE } from './Symbols';

const GRAMMARS_DIR = path.resolve(__dirname, '../../../grammars/examples');
const MACRO_FILE = 'macro.uci';
const MACRO_PATH = path.join(GRAMMARS_DIR, MACRO_FILE);

describe('Document', () => {
	const document = new UCDocument(MACRO_PATH, TRANSIENT_PACKAGE);

	// Ensure that the extracted name matches the joined file name.
	it(`document fileName === '${MACRO_FILE}'`, () => {
		expect(document.fileName).to.equal(MACRO_FILE);
	});

	it('is diagnostics free?', () => {
		indexDocument(document);

		const diagnostics = document.analyze();
		expect(diagnostics.length).to.equal(0);
	});
});

describe('Document with macros', () => {
	const document = new UCDocument(MACRO_PATH, TRANSIENT_PACKAGE);

	const inputStream = new CaseInsensitiveStream(document.readText());
	const lexer = new UCLexer(inputStream);

	const macroParser = createPreprocessor(document, lexer);
	if (macroParser) {
		applyMacroSymbols({ "debug": "" });
		preprocessDocument(document, macroParser);

		it('macro debug !== undefined', () => {
			const symbol = macroParser.getSymbolValue('debug'.toLowerCase());
			expect(symbol).to.not.equal(undefined);
		});

		it('macro classname !== undefined', () => {
			const symbol = macroParser.getSymbolValue('classname'.toLowerCase());
			expect(symbol).to.not.equal(undefined);
		});

		it('macro packagename !== undefined', () => {
			const symbol = macroParser.getSymbolValue('packagename'.toLowerCase());
			expect(symbol).to.not.equal(undefined);
		});

		it('macro IN_DEBUG === "true"', () => {
			const symbol = macroParser.getSymbolValue('IN_DEBUG'.toLowerCase());
			expect(symbol).to.not.equal(undefined);
			// FIXME, need to properly format the captured text.
			const cond = symbol && symbol.text === ' true\r';
			expect(cond).to.equal(true);
		});
	} else {
		// ??? no macros in macro.uci
	}
});