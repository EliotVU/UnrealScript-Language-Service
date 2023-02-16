import { expect } from 'chai';
import path = require('path');

import { getDocumentSymbol, getDocumentTooltip } from '../src/UC/helpers';
import { createDocumentByPath, createPackageByDir, indexDocument } from '../src/UC/indexer';

// TODO: E2E tests, write VSCode client tests instead.
describe('getDocumentTooltip', () => {
    const pathToObject = path.resolve(__dirname, 'workspace', 'TestPackage', 'Classes', 'TestPackage.uc');
    const testPackageDocument = createDocumentByPath(pathToObject, createPackageByDir(pathToObject));
    indexDocument(testPackageDocument);

    const classSymbol = testPackageDocument.class!;

    it('should match the class symbol', () => {
        const position = classSymbol.id.range.start;
        const symbol = getDocumentSymbol(testPackageDocument, position);
        expect(symbol)
            .to.equal(classSymbol);
    });

    it('should retrieve the class symbol display info', async () => {
        const hoverInfo = await getDocumentTooltip(testPackageDocument, classSymbol.id.range.start);
        expect(hoverInfo)
            .to.not.be.undefined;
    });
});