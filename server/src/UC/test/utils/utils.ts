import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import type { CommonTokenStream } from 'antlr4ts/CommonTokenStream';
import { Token } from 'antlr4ts/Token';
import { fail } from 'assert';
import { UCDocument } from '../../document';
import { createDocumentByPath, createPackageByDir, getDocumentById, removeDocumentByPath } from '../../indexer';
import { toName } from '../../name';
import { getTokenDebugInfo } from '../../Parser/Parser.utils';
import { CORE_PACKAGE, TRANSIENT_PACKAGE } from '../../Symbols';

export function registerDocuments(
    baseDir: string,
    fileNames: string[]
): UCDocument[] {
    const documents = fileNames.map(p => {
        const fullPath = path.join(baseDir, p);
        expect(fs.existsSync(fullPath),
            'Failed to register document by path.')
            .to.be.true;
        const pkg = createPackageByDir(fullPath);

        return createDocumentByPath(fullPath, pkg);
    });

    return documents;
}

export function unregisterDocuments(
    baseDir: string,
    fileNames: string[]
): void {
    fileNames.forEach(p => {
        const fullPath = path.join(baseDir, p);
        expect(removeDocumentByPath(fullPath),
            'Failed to unregister document by path.')
            .to.be.true;
    });
}

/**
 * Loads all documents using a baseDir and an array of fileNames.
 * When all documents have been loaded and indexed (declarations only), exec() will be invoked, and all documents will be discarded.
 */
export function usingDocuments(
    baseDir: string,
    fileNames: string[],
    exec: (documents: UCDocument[]) => void
): void {
    // HACK: Ensure we always have a core UObject to work with in tests.
    createDocumentByPath(path.resolve(__dirname, '../UnrealScriptTests/Core/Classes/Object.uc'), CORE_PACKAGE);
    createDocumentByPath(path.resolve(__dirname, '../UnrealScriptTests/Core/Classes/Interface.uc'), CORE_PACKAGE);

    const documents = registerDocuments(baseDir, fileNames);
    try {
        exec(documents);
    } finally {
        unregisterDocuments(baseDir, fileNames);
    }
}

/**
 * Asserts that a document exists by name.
 */
export function assertDocument(
    documentName: string
): UCDocument {
    const document = getDocumentById(toName(documentName))!;
    expect(document,
        `Missing '${documentName}' file`)
        .to.not.be.undefined;

    return document;
}

export function usingDocumentWithText(
    document: UCDocument,
    text: string,
    exec: (document: UCDocument) => void
): void {
    document.invalidate(true);

    try {
        document.build(text);
        exec(document);
    } finally {
        document.invalidate(true);
    }
}

const TRANSIENT_DOCUMENT = new UCDocument('//transient', TRANSIENT_PACKAGE);

/**
 * Asserts that the lexed tokens match the specified token sequence.
 *
 * @param text the UnrealScript text to lex and parse.
 * @param tokenSequence the sequence to compare against, all tokens are expected to be specified in the correct order.
 */
export function assertTokens(
    text: string,
    tokenSequence: (number | Partial<Token>)[],
    document: UCDocument = TRANSIENT_DOCUMENT
): Token[] {
    if (document == TRANSIENT_DOCUMENT) {
        document.invalidate(true);
    }

    const parseData = document.parse(text);
    const tokens = (<CommonTokenStream>parseData.parser.inputStream).getTokens();

    try {
        for (let i = 0; i < tokens.length; ++i) {
            let token: Partial<Token>;

            if (typeof tokenSequence[i] === 'number') {
                token = {
                    text: undefined,
                    type: tokenSequence[i] as number,
                };
            } else if (typeof tokenSequence[i] === 'object') {
                token = tokenSequence[i] as Token;
            } else if (typeof tokenSequence[i] === 'undefined') {
                fail(`Undefined token type [${i}]`);
            }

            if (typeof token.type !== 'undefined') {
                expect(parseData.parser.vocabulary.getSymbolicName(tokens[i].type),
                    `type mismatch against token ${getTokenDebugInfo(tokens[i], parseData.parser)}`)
                    .to.equal(parseData.parser.vocabulary.getSymbolicName(token.type));
            }

            if (typeof token.text !== 'undefined') {
                expect(tokens[i].text, `text mismatch against token ${getTokenDebugInfo(tokens[i], parseData.parser)}`)
                    .to.equal(token.text);
            }

            if (typeof token.channel !== 'undefined') {
                expect(tokens[i].channel, `channel mismatch against token ${getTokenDebugInfo(tokens[i], parseData.parser)}`)
                    .to.equal(token.channel);
            }

            // Ensure all token indexes are in order.
            expect(tokens[i].tokenIndex, getTokenDebugInfo(tokens[i], parseData.parser))
                .to.equal(i,
                    `token '${getTokenDebugInfo(tokens[i], parseData.parser)}' matched, but the index is incorrect`
                );

            console.info('✔', getTokenDebugInfo(tokens[i], parseData.parser));
        }
    } catch (exc) {
        console.debug('Assertion failed, printing out the full token set:');
        console.debug(tokens.map(t => getTokenDebugInfo(t, parseData.parser)).join('\n'));

        throw exc;
    }

    expect(tokens.length, 'fetched tokens count')
        .to.equal(tokenSequence.length, 'test tokens count');

    return tokens;
}
