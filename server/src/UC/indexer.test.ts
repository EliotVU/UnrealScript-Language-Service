import { expect } from 'chai';
import path from 'path';

import { createDocumentByPath, createPackage, getDocumentByURI, parsePackageNameInDir } from './indexer';
import { URI } from 'vscode-uri';

describe('Indexer', () => {
    it('document maps should not be case sensitive', () => {
        const filePath = path.resolve(__dirname, 'test', 'UnrealScriptTests/Classes/object.UC');
        const pkg = createPackage('pkg');
        const doc = createDocumentByPath(filePath, pkg);
        expect(getDocumentByURI(URI.file(filePath).toString())).to.equal(doc);
    });

    it('parsePackageNameInDir should return package name', () => {
        expect(parsePackageNameInDir(path.join('workspace', 'Core', 'Object.uc')))
            .to.equal('Core');

        expect(parsePackageNameInDir(path.join('workspace', 'Core', 'Classes', 'Object.uc')))
            .to.equal('Core');

        // Non-standard
        expect(parsePackageNameInDir(path.join('MutBestTimes', 'ClientBTimes', 'Classes', 'UI', 'BTClient_Menu.uc')))
            .to.equal('ClientBTimes');
    });
});
