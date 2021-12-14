import { expect } from 'chai';

import { toName } from './name';

describe('Names hashing', () => {
	it('Test == test', () => {
		expect(toName('Test')).to.equal(toName('test'));
	});

	it('Test != Class', () => {
		expect(toName('Test')).to.not.equal(toName('Class'));
	});
});
