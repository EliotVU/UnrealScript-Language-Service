import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { BehaviorSubject, firstValueFrom, interval, of, Subject, Subscription } from 'rxjs';
import { debounce, filter, map, switchMap, tap, timeout } from 'rxjs/operators';
import * as url from 'url';
import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import {
    CodeActionKind,
    CompletionTriggerKind,
    createConnection,
    ErrorCodes,
    FileOperationRegistrationOptions,
    InitializeParams,
    ProposedFeatures,
    Range,
    ResponseError,
    TextDocumentIdentifier,
    TextDocumentSyncKind,
    WorkspaceFolder,
} from 'vscode-languageserver/node';

import { executeCommand, getCommand, getCommands } from 'commands';
import { getDocumentDefinition } from 'documentDefinition';
import { getDocumentRenameEdit } from 'rename';
import { ActiveTextDocuments } from './activeTextDocuments';
import { getDocumentCodeActions } from './codeActions';
import {
    getCompletionItems,
    getFullCompletionItem,
    getSignatureHelp,
    updateIgnoredCompletionTokens,
} from './completion';
import { EAnalyzeOption, UCLanguageServerSettings } from './configuration';
import { getDocumentDiagnostics } from './documentDiagnostics';
import { getDocumentHighlights } from './documentHighlight';
import { getDocumentHover } from './documentHover';
import { getDocumentSymbols } from './documentSymbol';
import { getDocumentSemanticTokens } from './documentTokenSemantics';
import { getReferences } from './references';
import { UCDocument } from './UC/document';
import { createTypeFromQualifiedIdentifier } from './UC/documentASTWalker';
import { TokenModifiers, TokenTypes } from './UC/documentSemanticsBuilder';
import {
    getSymbol,
    resolveSymbolToRef,
    VALID_ID_REGEXP,
} from './UC/helpers';
import {
    config,
    createDocumentByPath,
    createPackage,
    createPackageByDir,
    documentBuilt$,
    documentsCodeIndexed$,
    enumerateDocuments,
    getDocumentById,
    getDocumentByURI,
    getPendingDocumentsCount,
    indexDocument,
    indexPendingDocuments,
    queueIndexDocument,
    removeDocumentByPath,
} from './UC/indexer';
import { toName } from './UC/name';
import { NAME_ARRAY, NAME_CLASS, NAME_FUNCTION, NAME_NONE } from './UC/names';
import { applyGlobalMacroSymbols, clearGlobalMacroSymbols } from './UC/Parser/PreprocessorParser';
import { IntrinsicSymbolItemMap, UCGeneration, UELicensee } from './UC/settings';
import {
    addHashedSymbol,
    CORE_PACKAGE,
    DEFAULT_RANGE,
    IntrinsicArray,
    isClass,
    isField,
    ObjectsTable,
    tryFindClassSymbol,
    tryFindSymbolInPackage,
    UCClassSymbol,
    UCMethodSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCPackage,
    UCQualifiedTypeSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './UC/Symbols';
import { ModifierFlags } from './UC/Symbols/ModifierFlags';
import { UnrealPackage } from './UPK/UnrealPackage';
import { getFiles, isDocumentFileName } from './workspace';
import { getWorkspaceSymbols } from './workspaceSymbol';

/**
 * Emits true when the workspace is prepared and ready for indexing.
 * If false, the workspace is expected to be invalidated and re-indexed.
 **/
const isIndexReady$ = new Subject<boolean>();
const pendingDocuments$ = new BehaviorSubject<UCDocument[]>([]);

/** Emits a document that is pending an update. */
const pendingTextDocument$ = new Subject<{
    textDocument: TextDocument,
    source: string
}>();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasSemanticTokensCapability = false;

let documentFileGlobPattern = "**/*.{uc,uci}";
let packageFileGlobPattern = "**/*.{u,upk}";

type WorkspaceFiles = {
    documentFiles: string[];
    packageFiles: string[];
};

type WorkspaceContent = {
    documents: UCDocument[];
    packages: UnrealPackage[];
};

async function getWorkspaceFiles(folders: WorkspaceFolder[], reason: string): Promise<WorkspaceFiles> {
    let documentFiles: string[] = [];
    let packageFiles: string[] = [];

    for (const folder of folders) {
        const folderFSPath = url.fileURLToPath(folder.uri);
        connection.console.info(`Scanning folder '${folderFSPath}' using pattern '${packageFileGlobPattern}', '${documentFileGlobPattern}'`);
        await Promise.all([
            getFiles(folderFSPath, packageFileGlobPattern).then((matches) => {
                connection.console.info(`(${reason}) Found '${matches.length}' package files in '${folderFSPath}'`);
                folders.length == 1 ? (packageFiles = matches) : packageFiles.push(...matches);
            }),
            getFiles(folderFSPath, documentFileGlobPattern).then((matches) => {
                connection.console.info(`(${reason}) Found '${matches.length}' document files in '${folderFSPath}'`);
                folders.length == 1 ? (documentFiles = matches) : documentFiles.push(...matches);
            })
        ]);
    }
    return { documentFiles, packageFiles };
}

function registerDocument(filePath: string): UCDocument {
    return createDocumentByPath(filePath, createPackageByDir(filePath));
}

function registerDocuments(files: string[]): UCDocument[] {
    return files.map(registerDocument);
}

function unregisterDocuments(files: string[]) {
    for (const filePath of files) {
        removeDocumentByPath(filePath);
    }
}

function createPackageStream(filePath: string) {
    const stream = fs.createReadStream(filePath, undefined);
    return stream;
}

function createPackageFromPath(filePath: string): UCPackage {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath, ext);
    const pkg = createPackage(fileName);
    return pkg;
}

async function parsePackageFile(filePath: string): Promise<UnrealPackage> {
    const rootPackage = createPackageFromPath(filePath);
    const packageFile = new UnrealPackage(rootPackage);

    // connection.console.info(`Parsing package file '${filePath}'`);
    // const packageStream = new UnrealPackageStream(createPackageStream(filePath));
    // try {
    //     await packageStream.open();
    //     await deserializePackage(packageFile, packageStream);
    // } finally {
    //     packageStream.close();
    // }

    return packageFile;
}

async function registerWorkspaceFiles(workspace: WorkspaceFiles): Promise<WorkspaceContent> {
    const packages = await Promise.all(workspace.packageFiles.map(parsePackageFile));
    const documents = registerDocuments(workspace.documentFiles);

    return {
        documents,
        packages
    };
}

function unregisterWorkspaceFiles(workspace: WorkspaceFiles) {
    if (workspace.documentFiles) {
        unregisterDocuments(workspace.documentFiles);
    }
}

async function registerWorkspace(folders: WorkspaceFolder[] | null): Promise<WorkspaceContent | undefined> {
    if (folders) {
        const getStartTime = performance.now();
        const workspaceFiles = await getWorkspaceFiles(folders, 'initialize');
        connection.console.log(`Found workspace files in ${(performance.now() - getStartTime) / 1000} seconds!`);

        const registerStartTime = performance.now();
        const workspaceContent = await registerWorkspaceFiles(workspaceFiles);
        connection.console.log(`Registered workspace files in ${(performance.now() - registerStartTime) / 1000} seconds!`);

        return workspaceContent;
    }

    return undefined;
}

function invalidatePendingDocuments() {
    const documents = pendingDocuments$.getValue();
    for (let i = 0; i < documents.length; ++i) {
        documents[i].invalidate();
    }
}

async function awaitDocumentDelivery(textDocument: TextDocument | TextDocumentIdentifier, timeoutEach = 1000 * 60): Promise<UCDocument | undefined> {
    const document = getDocumentByURI(textDocument.uri);
    if (document?.hasBeenIndexed) {
        return document;
    }

    const indexedVersion = 'version' in textDocument
        ? textDocument.version
        : undefined;

    return firstValueFrom(documentsCodeIndexed$
        .pipe(
            map(docs => docs.find((d => d.uri === textDocument.uri
                && (typeof indexedVersion === 'undefined' || d.indexedVersion === indexedVersion)
            ))),
            filter(doc => !!doc!),
            timeout({
                each: timeoutEach,
                with: () => of(undefined)
            })
        ));
}

async function awaitDocumentBuilt(uri: DocumentUri, timeoutEach = 1000 * 60): Promise<UCDocument | undefined> {
    const document = getDocumentByURI(uri);
    if (document?.hasBeenBuilt) {
        return document;
    }

    return firstValueFrom(documentBuilt$
        .pipe(
            filter(doc => doc.uri === uri),
            timeout({
                each: timeoutEach,
                with: () => {
                    return of(undefined);
                }
            })
        ));
}

const connection = createConnection(ProposedFeatures.all);
connection.listen();

let lastIndexedDocumentsSub: Subscription;
let isIndexReadySub: Subscription;
let documentsSub: Subscription;

connection.onShutdown(() => {
    lastIndexedDocumentsSub?.unsubscribe();
    isIndexReadySub?.unsubscribe();
    documentsSub?.unsubscribe();
});

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasSemanticTokensCapability = !!(capabilities.textDocument?.semanticTokens);

    if (!hasConfigurationCapability) {
        // Using the default settings.
        initializeConfiguration();
    }

    if (!hasWorkspaceFolderCapability && params.rootUri) {
        registerWorkspace([{
            uri: params.rootUri,
            name: 'default'
        }]);
    }

    // FIXME: Not affected by the configured documentFileGlobPattern
    const fileOperation: FileOperationRegistrationOptions = {
        filters: [{
            scheme: 'file',
            pattern: {
                glob: documentFileGlobPattern,
                options: {
                    ignoreCase: true
                }
            }
        }]
    };

    return {
        capabilities: {
            workspace: {
                fileOperations: {
                    didCreate: fileOperation,
                    didRename: fileOperation,
                    didDelete: fileOperation
                },
                workspaceFolders: {
                    supported: true,
                    changeNotifications: true
                },
            },
            textDocumentSync: TextDocumentSyncKind.Full,
            hoverProvider: true,
            completionProvider: {
                triggerCharacters: ['.', '"', '\'', '`', '<'],
                resolveProvider: true
            },
            signatureHelpProvider: {
                triggerCharacters: ['(', ','],
                retriggerCharacters: [',']
            },
            definitionProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            documentHighlightProvider: true,
            referencesProvider: true,
            renameProvider: {
                prepareProvider: true
            },
            codeActionProvider: {
                codeActionKinds: [
                    CodeActionKind.RefactorExtract
                ],
                dataSupport: true
            },
            executeCommandProvider: {
                commands: getCommands()
            },
            semanticTokensProvider: {
                documentSelector: null,
                full: true,
                range: true,
                legend: {
                    tokenTypes: TokenTypes,
                    tokenModifiers: TokenModifiers
                },
            }
        }
    };
});

connection.onInitialized((params) => {
    lastIndexedDocumentsSub = documentsCodeIndexed$
        .pipe(
            filter(() => config.analyzeDocuments !== EAnalyzeOption.None),
            debounce(() => interval(config.analyzeDocumentDebouncePeriod)),
        )
        .subscribe(documents => {
            if (config.analyzeDocuments === EAnalyzeOption.OnlyActive) {
                // Only analyze active documents.
                documents = documents.filter(document => ActiveTextDocuments.get(document.uri));
            }

            for (const document of documents) {
                try {
                    const diagnostics = getDocumentDiagnostics(document);
                    connection.sendDiagnostics({
                        uri: document.uri,
                        diagnostics
                    });
                } catch (error) {
                    connection.console.error(`Analysis of document "${document.uri}" threw '${error}'`);
                }
            }
        });

    isIndexReadySub = isIndexReady$
        .pipe(
            switchMap(() => pendingTextDocument$),
            filter(({ textDocument, source }) => {
                if (process.env.NODE_ENV === 'development') {
                    connection.console.log(`Processing pending document "${textDocument.uri}":${textDocument.version}, source:${source}.`);
                }

                const document = getDocumentByURI(textDocument.uri);
                if (!document) {
                    // Don't index documents that are not part of the workspace.
                    return false;
                }

                if (source === 'change' && textDocument.version !== document.indexedVersion) {
                    // we are gonna wait 50ms before indexing the changes,
                    // therefore we want to ensure that any observers will receive this document as incomplete before the 50ms elapses.
                    document.hasBeenBuilt = false;
                    document.hasBeenIndexed = false;
                }
                return true;
            }),
            debounce(({ source }) => interval(source === 'change' ? config.indexDocumentDebouncePeriod : undefined))
        )
        .subscribe({
            next: async ({ textDocument, source }) => {
                const document = getDocumentByURI(textDocument.uri);
                if (!document) {
                    // Don't index documents that are not part of the workspace.
                    return;
                }

                const isDirty = textDocument.version !== document.indexedVersion;
                if (isDirty) {
                    if (process.env.NODE_ENV === 'development') {
                        connection.console.log(`Invalidating document "${document.fileName}".`);
                    }
                    document.invalidate();
                }

                if (document.hasBeenIndexed) {
                    if (process.env.NODE_ENV === 'development') {
                        connection.console.log(`Document "${document.fileName}" is already indexed.`);
                    }

                    return;
                }

                const work = await connection.window.createWorkDoneProgress();
                work.begin(
                    `Indexing document "${document.fileName}"`,
                    0.0,
                    undefined,
                    true);

                const fullText = textDocument.getText();
                indexDocument(document, fullText);

                let i = 0;
                const dependenciesCount = getPendingDocumentsCount();
                indexPendingDocuments((doc => {
                    if (work.token.isCancellationRequested) {
                        return true;
                    }
                    work.report(i++ / dependenciesCount, `Indexing document "${doc.fileName}"`);
                    return false;
                }));

                document.indexedVersion = textDocument.version;
                work.done();
            },
            error: err => {
                connection.console.error(`Index queue error: '${err}'`);
            }
        });

    documentsSub = isIndexReady$
        .pipe(
            tap(value => {
                if (value) {
                    return;
                }
                invalidatePendingDocuments();
            }),
            switchMap(() => pendingDocuments$),
            filter(documents => documents.length > 0)
        )
        .subscribe((async (documents) => {
            if (config.generation === UCGeneration.Auto) {
                const newGeneration = tryAutoDetectGeneration();
                if (newGeneration) {
                    config.generation = newGeneration;
                    connection.console.info(`Auto-detected generation ${config.generation}.`);
                } else {
                    connection.console.warn(`Auto-detection failed, resorting to UC3.`);
                }
            }

            // Add all the presets before continueing
            await registerPresetsWorkspace(config.generation, config.licensee);

            const indexStartTime = performance.now();
            const work = await connection.window.createWorkDoneProgress();
            work.begin(
                'Indexing workspace',
                0.0,
                'The workspace documents are being processed.',
                true);
            try {
                // Weird, even if when we have "zero" active documents, this array is filled?
                const activeDocuments = ActiveTextDocuments
                    .all()
                    .map(doc => getDocumentByURI(doc.uri))
                    .filter(Boolean) as UCDocument[];

                for (let i = activeDocuments.length - 1; i >= 0; i--) {
                    connection.console.log(`Queueing active document "${activeDocuments[i].fileName}".`);
                    work.report(activeDocuments.length / i - 1.0, `${activeDocuments[i].fileName}`);
                    // if (documents[i].hasBeenIndexed) {
                    //     continue;
                    // }

                    if (work.token.isCancellationRequested) {
                        connection.console.warn(`The workspace indexing has been cancelled.`);
                        break;
                    }

                    activeDocuments[i].invalidate();
                    queueIndexDocument(activeDocuments[i]);
                }

                if (config.indexAllDocuments) {
                    for (let i = 0; i < documents.length; i++) {
                        work.report(i / documents.length, `${documents[i].fileName} + dependencies`);
                        if (documents[i].hasBeenIndexed) {
                            continue;
                        }

                        if (work.token.isCancellationRequested) {
                            connection.console.warn(`The workspace indexing has been cancelled.`);
                            break;
                        }

                        queueIndexDocument(documents[i]);
                    }
                }
            } finally {
                work.done();

                const time = performance.now() - indexStartTime;
                connection.console.log(`UnrealScript documents have been indexed in ${time / 1000} seconds!`);
            }
        }));

    if (hasConfigurationCapability) {
        connection.workspace.getWorkspaceFolders()
            .then((workspaceFolders) => {
                return registerWorkspace(workspaceFolders);
            })
            .then(() => {
                // re-queue
                pendingDocuments$.next(Array.from(enumerateDocuments()));

                isIndexReady$.next(true);
            });

    } else {
        isIndexReady$.next(true);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
            if (event.added.length) {
                const workspaceFiles = await getWorkspaceFiles(event.added, 'workspace files added');
                registerWorkspaceFiles(workspaceFiles);
            }

            // FIXME: Doesn't clean up any implicit created packages, nor names.
            if (event.removed.length) {
                const workspaceFiles = await getWorkspaceFiles(event.removed, 'workspace files removed');
                unregisterWorkspaceFiles(workspaceFiles);
            }

            // re-queue
            pendingDocuments$.next(Array.from(enumerateDocuments()));
        });

        connection.workspace.onDidCreateFiles(params => {
            const newFiles = params.files
                .map(f => url.fileURLToPath(f.uri))
                .filter(isDocumentFileName);
            registerDocuments(newFiles)
                .forEach(document => {
                    queueIndexDocument(document);
                });
        });

        connection.workspace.onDidRenameFiles(params => {
            const oldFiles = params.files
                .map(f => url.fileURLToPath(f.oldUri))
                .filter(isDocumentFileName);
            // TODO: Need to trigger a re-index event for all documents that have a dependency on these files.
            unregisterDocuments(oldFiles);

            const newFiles = params.files
                .map(f => url.fileURLToPath(f.newUri))
                .filter(isDocumentFileName);
            registerDocuments(newFiles)
                .forEach(document => {
                    queueIndexDocument(document);
                });
        });

        connection.workspace.onDidDeleteFiles(params => {
            const files = params.files
                .map(f => url.fileURLToPath(f.uri))
                .filter(isDocumentFileName);

            // TODO: Need to trigger a re-index event for all documents that have a dependency on these files.
            unregisterDocuments(files);
        });
    } else {
        // TODO: Support non-workspace environments?
    }

    if (hasSemanticTokensCapability) {
        async function getSemanticTokens(textDocument: TextDocumentIdentifier, range?: Range) {
            const document = await awaitDocumentBuilt(textDocument.uri);
            if (document) {
                return getDocumentSemanticTokens(document, range);
            }

            return {
                data: []
            };
        }

        connection.languages.semanticTokens.on(e => {
            return getSemanticTokens(e.textDocument);
        });
        connection.languages.semanticTokens.onRange(e => {
            return getSemanticTokens(e.textDocument, e.range);
        });
    }

    // We need to sync the opened document with current state.
    ActiveTextDocuments.onDidOpen(e => pendingTextDocument$.next({
        textDocument: e.document,
        source: 'open'
    }));
    ActiveTextDocuments.onDidChangeContent(e => pendingTextDocument$.next({
        textDocument: e.document,
        source: 'change'
    }));
    // We need to re--index the document, incase that the end-user edited a document without saving its changes.
    ActiveTextDocuments.onDidClose(e => pendingTextDocument$.next({
        textDocument: e.document,
        source: 'close'
    }));
    ActiveTextDocuments.listen(connection);
});

connection.onDidChangeConfiguration((params: { settings: { unrealscript: UCLanguageServerSettings } }) => {
    setConfiguration(params.settings.unrealscript);
    initializeConfiguration();

    connection.console.info(`Re-indexing workspace due configuration changes.`);
    isIndexReady$.next(false);
});

function setConfiguration(settings: UCLanguageServerSettings) {
    Object.assign(config, settings);
}

function initializeConfiguration() {
    clearGlobalMacroSymbols();
    clearIntrinsicSymbols();

    // Ensure that we are working with sane values!
    config.indexDocumentDebouncePeriod = Math.max(Math.min(config.indexDocumentDebouncePeriod, 300), 0.0);
    config.analyzeDocumentDebouncePeriod = Math.max(Math.min(config.analyzeDocumentDebouncePeriod, 1000), 0.0);

    applyConfiguration(config);
}

function applyConfiguration(settings: UCLanguageServerSettings) {
    applyGlobalMacroSymbols(settings.macroSymbols);
    installIntrinsicSymbols(settings.intrinsicSymbols);
    updateIgnoredCompletionTokens(settings);
    setupFilePatterns(settings);
}

/**
 * Auto-detects the UnrealScript generation.
 * This test is performed before any parsing/indexing has occurred, although it may also re-occur after a re-index.
 * The code should assume that no UC symbols do exist other than packages.
 */
function tryAutoDetectGeneration(): UCGeneration | undefined {
    let document = getDocumentById(toName('Object'));
    if (!document || document.classPackage !== CORE_PACKAGE) {
        return undefined;
    }

    // UE3 has Component.uc we can use to determine the generation.
    document = getDocumentById(toName('Component'));
    if (document?.classPackage === CORE_PACKAGE) {
        return UCGeneration.UC3;
    }

    // No Commandlet.uc in older UE1
    document = getDocumentById(toName('Commandlet'));
    if (!document) {
        return UCGeneration.UC1;
    }

    // Okay we have a Commandlet.uc document (UT99)
    if (document.classPackage === CORE_PACKAGE) {
        if (getDocumentById(toName('HelpCommandlet'))?.classPackage === CORE_PACKAGE ||
            getDocumentById(toName('HelloWorldCommandlet'))?.classPackage === CORE_PACKAGE) {
            return UCGeneration.UC1;
        }

        // UE2 / UT2004
        return UCGeneration.UC2;
    }

    // Failed auto
    return undefined;
}

/**
 * Register the presets workspace for the given generation and licensee.
 */
async function registerPresetsWorkspace(generation: UCGeneration, licensee: UELicensee): Promise<WorkspaceContent | undefined> {
    function pathToWorkspaceFolder(folderPath: string): WorkspaceFolder {
        return {
            uri: url.pathToFileURL(folderPath).toString(),
            name: path.basename(folderPath)
        };
    }

    const presetsPath = path.join(__dirname, 'presets');
    const folders: WorkspaceFolder[] = [];

    switch (generation) {
        case UCGeneration.UC1:
            folders.push(pathToWorkspaceFolder(path.join(presetsPath, 'UE1')));
            break;

        case UCGeneration.UC2:
            folders.push(pathToWorkspaceFolder(path.join(presetsPath, 'UE2')));
            break;

        case UCGeneration.UC3:
            folders.push(pathToWorkspaceFolder(path.join(presetsPath, 'UE3')));
            break;
    }

    // Maybe automate this by using the licensee string as the folder name of presets?
    switch (licensee) {
        case UELicensee.XCom:
            // no presets that we have, but feel free to add of course!!
            break;
    }

    // Always include the 'Shared' presets, included as last so that they cannot not precede any of the licensee or generation specific documents of the same name.
    folders.push(pathToWorkspaceFolder(path.join(presetsPath, 'Shared')));

    // blob search all the files in the presets folder!
    const workspaceFiles = await getWorkspaceFiles(folders, 'presets');

    // create and register the documents
    return registerWorkspaceFiles(workspaceFiles);
}

function clearIntrinsicSymbols() {
    // TODO: Implement
}

function installIntrinsicSymbols(intrinsicSymbols: IntrinsicSymbolItemMap) {
    const classSymbols = [];
    const intSymbols = Object.entries(intrinsicSymbols);
    for (const [key, value] of intSymbols) {
        const [pkgNameStr, symbolNameStr] = key.split('.');

        const symbolName = VALID_ID_REGEXP.test(symbolNameStr)
            ? toName(symbolNameStr) : NAME_NONE;

        if (symbolName === NAME_NONE) {
            console.error(`Invalid identifier '${symbolNameStr}' in key '${key}'`);
            continue;
        }

        const typeName = value.type
            ? toName(value.type) : NAME_NONE;
        switch (typeName) {
            case NAME_CLASS: {
                if (ObjectsTable.getSymbol(symbolName, UCSymbolKind.Class)) {
                    continue;
                }

                const symbol = new UCClassSymbol({ name: symbolName, range: DEFAULT_RANGE }, DEFAULT_RANGE);
                symbol.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Generated;
                if (value.extends) {
                    symbol.extendsType = createTypeFromQualifiedIdentifier(value.extends);
                }
                const pkg = createPackage(pkgNameStr);
                symbol.outer = pkg;
                addHashedSymbol(symbol);
                classSymbols.push(symbol);
                break;
            }

            case NAME_FUNCTION: {
                if (typeof value.extends !== 'string') {
                    console.error(`Invalid extends value in key '${key}'`);
                    continue;
                }
                const extendsName = VALID_ID_REGEXP.test(value.extends)
                    ? toName(value.extends) : NAME_NONE;
                let superStruct: UCStructSymbol | undefined;
                switch (extendsName) {
                    case NAME_ARRAY:
                        superStruct = IntrinsicArray;
                        break;

                    default:
                        // superStruct = superStruct = ObjectsTable.getSymbol<UCStructSymbol>(extendsName.hash);
                        console.error(`Unsupported extends type '${value.extends}' in key '${key}'`);
                        break;
                }

                if (!(superStruct instanceof UCStructSymbol)) {
                    console.error(`Couldn't find the specified struct of 'extends' '${value.extends}' in key '${key}'`);
                    continue;
                }

                const symbol = new UCMethodSymbol({ name: symbolName, range: DEFAULT_RANGE }, DEFAULT_RANGE);
                symbol.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Generated;
                superStruct.addSymbol(symbol);
                break;
            }

            default:
                console.error(`Unsupported intrinsic type '${value.extends}' in key '${key}'`);
                break;
        }
    }

    const randomizeOrderName = toName('RandomizeOrder');
    let randomizeOrderSymbol = IntrinsicArray.getSymbol(randomizeOrderName);
    if (randomizeOrderSymbol) {
        if (config.licensee !== UELicensee.XCom) {
            IntrinsicArray.removeSymbol(randomizeOrderSymbol);
        }
    } else if (config.licensee === UELicensee.XCom) {
        randomizeOrderSymbol = new UCMethodSymbol({ name: randomizeOrderName, range: DEFAULT_RANGE }, DEFAULT_RANGE);
        randomizeOrderSymbol.modifiers |= ModifierFlags.Intrinsic;
        IntrinsicArray.addSymbol(randomizeOrderSymbol);
    }

    // Link classes to their parent class, so that we can run a proper inheritance analysis for classes that either link or extend intrinsic classes.
    // FIXME: We cannot pass these to an indexer, because we need a document for that :(
    classSymbols.forEach(symbol => {
        if (symbol.extendsType) {
            if (UCQualifiedTypeSymbol.is(symbol.extendsType)) {
                const parentClassPackage = ObjectsTable.getSymbol<UCPackage>(symbol.extendsType.left!.getName(), UCSymbolKind.Package);
                if (parentClassPackage) {
                    const parentClass = tryFindSymbolInPackage(symbol.extendsType.type.getName(), parentClassPackage);
                    symbol.extendsType.type.setRefNoIndex(parentClass);
                }
            } else if (symbol.extendsType instanceof UCObjectTypeSymbol) {
                const parentClass = tryFindClassSymbol(symbol.extendsType.getName());
                symbol.extendsType.setRefNoIndex(parentClass);
            }
        }
    });
}

function setupFilePatterns(settings: UCLanguageServerSettings) {
    const packageFileExtensions = settings.indexPackageExtensions
        ?.filter(ext => /^\w+$/.test(ext)) // prevent injection
        ?? ['u', 'upk'];
    packageFileGlobPattern = `**/*.{${packageFileExtensions.join(',')}}`;

    const documentFileExtensions = settings.indexDocumentExtensions
        ?.filter(ext => /^\w+$/.test(ext)) // prevent injection
        ?? ['uc', 'uci'];
    documentFileGlobPattern = `**/*.{${documentFileExtensions.join(',')}}`;
}

connection.onHover(async (e) => {
    const document = await awaitDocumentDelivery(e.textDocument, 5000);
    if (document) {
        return getDocumentHover(document, e.position);
    }

    return undefined;
});

connection.onDefinition(async (e) => {
    const document = await awaitDocumentDelivery(e.textDocument, 5000);
    if (document) {
        return getDocumentDefinition(document, e.position);
    }

    return undefined;
});

connection.onReferences((e) => getReferences(e.textDocument.uri, e.position, e.context));
connection.onDocumentSymbol(async (e) => {
    const document = await awaitDocumentBuilt(e.textDocument.uri);
    if (document) {
        return getDocumentSymbols(document);
    }

    return undefined;
});
connection.onWorkspaceSymbol((e) => {
    return getWorkspaceSymbols(e.query);
});

connection.onDocumentHighlight((e) => getDocumentHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => {
    // re-use the indexed document when not invoked by an identifier.
    return (e.context?.triggerKind === CompletionTriggerKind.Invoked
        ? getCompletionItems(e.textDocument.uri, e.position)
        : firstValueFrom(documentsCodeIndexed$).then(_documents => {
            return getCompletionItems(e.textDocument.uri, e.position);
        }))
        .then(items => {
            if (items?.length === 0) {
                // Prefer general text suggestions!
                return undefined;
            }

            return items;
        });
});
connection.onCompletionResolve(getFullCompletionItem);
connection.onSignatureHelp((e) => {
    // re-use the indexed document when not invoked by an identifier.
    if (e.context?.triggerKind !== CompletionTriggerKind.Invoked) {
        return firstValueFrom(documentsCodeIndexed$).then(_documents => {
            return getSignatureHelp(e.textDocument.uri, e.position);
        });
    }

    return getSignatureHelp(e.textDocument.uri, e.position);
});

connection.onPrepareRename((e) => {
    const symbol = getSymbol(e.textDocument.uri, e.position);
    if (!symbol) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    const symbolRef = resolveSymbolToRef(symbol);
    if (!(symbolRef instanceof UCObjectSymbol)) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Symbol without a defined type e.g. defaultproperties, replication etc.
    if (symbolRef.getTypeKind() === UCTypeKind.Error) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    if (isField(symbolRef)) {
        if (isClass(symbolRef)) {
            throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this class!');
        }
        if (symbolRef.modifiers & ModifierFlags.Intrinsic) {
            throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this instrinsic element!');
        }
    } else {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this non-field element!');
    }

    // Disallow symbols with invalid identifiers, such as an operator.
    if (!VALID_ID_REGEXP.test(symbol.getName().text)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'You cannot rename this element with an invalid identifier!');
    }

    return symbol.id.range;
});

connection.onRenameRequest((e) => {
    if (!VALID_ID_REGEXP.test(e.newName)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'Invalid identifier!');
    }

    return getDocumentRenameEdit(e.textDocument.uri, e.position, e.newName);
});

connection.onCodeAction(e => getDocumentCodeActions(e.textDocument.uri, e.range));

connection.onExecuteCommand(async e => {
    const command = getCommand(e.command);
    if (!command) {
        throw new Error('Unknown command');
    }

    const change = executeCommand(command, e.arguments);
    if (!change) {
        return;
    }

    const result = await connection.workspace.applyEdit({
        label: e.command,
        edit: change.edit
    });

    if (!result.applied) {
        return;
    }

    // Re-index after edit
    // This doesn't work because the edit is pending 'save' :/
    // if (e.command === CommandIdentifier.CreateClass
    //     && e.arguments
    //     && e.arguments.length > 0
    //     && typeof e.arguments[0].uri === 'string') {
    //     const document = getDocumentByURI(e.arguments[0].uri);
    //     if (document) {
    //         document.invalidate();
    //         indexDocument(document);
    //     }
    // }
});
