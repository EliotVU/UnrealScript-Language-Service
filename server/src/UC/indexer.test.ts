import { expect } from 'chai';
import path from 'path';

import { parsePackageNameInDir } from './indexer';

describe('Indexer', () => {
    it('parsePackageNameInDir should return package name', () => {
        expect(parsePackageNameInDir(path.join('workspace', 'Core', 'Object.uc')))
            .to.be.undefined;

        expect(parsePackageNameInDir(path.join('workspace', 'Core', 'Classes', 'Object.uc')))
            .to.equal('Core');

        // Non-standard
        expect(parsePackageNameInDir(path.join('MutBestTimes', 'ClientBTimes', 'Classes', 'UI', 'BTClient_Menu.uc')))
            .to.equal('ClientBTimes');
    });
});
