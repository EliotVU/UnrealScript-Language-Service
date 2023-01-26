import { expect } from 'chai';

import { UCInputStream } from './InputStream';

describe('InputStream', () => {
    const testString = 'Aa';
	const inputStream = UCInputStream.fromString(testString);

	it(`inputStream is defined`, () => {
		expect(inputStream).to.not.be.undefined;
	});

	it('Is case insensitive', () => {
        const upperCaseLetter = testString[0];
        const lowerCaseLetter = testString[1];
		expect(inputStream.LA(1)).to.equal(lowerCaseLetter.codePointAt(0));
		expect(inputStream.LA(1)).to.equal(lowerCaseLetter.codePointAt(0));
	});
});