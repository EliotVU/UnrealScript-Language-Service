import { expect } from 'chai';

import { toName } from './name';

describe('Names hashing', () => {
	it('Actor == actor && Actor == Actor', () => {
		expect(toName('Actor')).to.equal(toName('actor'));
		expect(toName('Actor')).to.equal(toName('Actor'));
	});

	it('Actor != Class', () => {
		expect(toName('Actor')).to.not.equal(toName('Class'));
	});

    it('Performance', () => {
        console.time('Hashing time');
        // about (60%) slower in a test of a million iterations.
        // const hash = CRC32.str(text.toLowerCase());
        for (let i = 0; i < 1_000_000; ++ i) {
            toName('Actor');
            // toName('Actor_'+i);
        }
        console.timeEnd('Hashing time');
    });
});
