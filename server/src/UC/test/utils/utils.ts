import { expect } from 'chai';
import * as path from 'path';

import { UCDocument } from '../../document';
import { createDocumentByPath, getDocumentById, removeDocumentByPath } from '../../indexer';
import { toName } from '../../name';
import { TRANSIENT_PACKAGE } from '../../Symbols';

export function registerDocuments(baseDir: string, fileNames: string[]): UCDocument[] {
    const documents = fileNames.map(p => {
        const fullPath = path.join(path.resolve(baseDir), p);
        return createDocumentByPath(fullPath, TRANSIENT_PACKAGE);
    });

    return documents;
}

export function unregisterDocuments(baseDir: string, fileNames: string[]): void {
    fileNames.forEach(p => {
        const fullPath = path.join(path.resolve(baseDir), p);
        removeDocumentByPath(fullPath);
    });
}

/**
 * Loads all documents using a baseDir and an array of fileNames.
 * When all documents have been loaded and indexed (declarations only), exec() will be invoked, and all documents will be discarded.
 */
export function usingDocuments(baseDir: string, fileNames: string[], exec: (documents: UCDocument[]) => void): void {
    const documents = registerDocuments(baseDir, fileNames);
    try {
        exec(documents);
    } finally {
        unregisterDocuments(baseDir, fileNames);
    }
}

export function assertDocument(documentName: string): UCDocument {
    const document = getDocumentById(toName(documentName))!;
    expect(document, `Missing '${documentName}' file`).to.not.be.undefined;
    return document;
}