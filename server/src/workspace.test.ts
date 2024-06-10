import { expect } from 'chai';
import * as path from 'path';
import { URI } from 'vscode-uri';

import { getFiles, isDocumentFileName, isPackageFileName, readTextByURI } from './workspace';

describe('Scan workspace', () => {
    it('should get document files', async () => {
        const pattern = '**/*.{uc,uci}';
        const folders = [
            path.resolve(__dirname, '../', 'test', 'workspace', 'Core'),
            path.resolve(__dirname, '../', 'test', 'workspace', 'TestPackage'),
        ];
        const folderFilePaths = await Promise.all(folders.map(folderPath => getFiles(folderPath, pattern)));
        expect(folderFilePaths[0].length !== folderFilePaths[1].length, JSON.stringify(folderFilePaths))
            .to.be.true;
        expect(folderFilePaths.every(files => files.every(filePath => isDocumentFileName(filePath))))
            .to.be.true;
        expect(folderFilePaths.every(files => files.every(filePath => isPackageFileName(filePath))))
            .to.be.false;

        // See if the URI conversion is working.
        expect(folderFilePaths.every(files => files.map(filePath => readTextByURI(URI.file(filePath).toString())).every(text => typeof text !== 'undefined')));
    });
});
