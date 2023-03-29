import { expect } from 'chai';
import path = require('path');

import { getFiles, isDocumentFileName, isPackageFileName } from './workspace';

describe('Scan workspace', () => {
    it('should get document files', async () => {
        const pattern = '**/*.{uc,uci}';
        const folders = [
            path.resolve(__dirname, '../', 'test', 'workspace', 'Core'),
            path.resolve(__dirname, '../', 'test', 'workspace', 'TestPackage'),
        ];
        const files = await Promise.all(folders.map(folderPath => getFiles(folderPath, pattern)));
        expect(files[0].length !== files[1].length, JSON.stringify(files))
            .to.be.true;
        expect(files.every(files => files.every(filePath => isDocumentFileName(filePath))))
            .to.be.true;
        expect(files.every(files => files.every(filePath => isPackageFileName(filePath))))
            .to.be.false;
    });
});