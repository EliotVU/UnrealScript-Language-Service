import { expect } from 'chai';

import { clearNames, toName } from './name';

describe('Names hashing', () => {
    it('Actor == actor && Actor == Actor', () => {
        expect(toName('Actor')).to.equal(toName('actor'));
        expect(toName('Actor')).to.equal(toName('Actor'));
    });

    it('Actor != Class', () => {
        expect(toName('Actor')).to.not.equal(toName('Class'));
    });

    // about (60%) slower in a test of a million iterations.
    // const hash = CRC32.str(text.toLowerCase());
    it('Performance', () => {
        toName('Actor'); // pre-cache

        console.time('Hashing get time');
        for (let i = 0; i < 1_000_000; ++i) {
            toName('Actor');
        }
        console.timeEnd('Hashing get time');

        console.time('Hashing set time');
        for (let i = 0; i < 1_000_000; ++i) {
            toName('Actor_' + i);
        }
        console.timeEnd('Hashing set time');

        clearNames();
    });
});
