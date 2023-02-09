import * as fs from 'fs';
import glob from 'glob';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { BehaviorSubject, firstValueFrom, interval, Subject, Subscription } from 'rxjs';
import { debounce, delay, filter, map, switchMap, tap, timeout } from 'rxjs/operators';
import * as url from 'url';
import { DocumentUri, TextDocument } from 'vscode-languageserver-textdocument';
import {
    CodeActionKind,
    CompletionTriggerKind,
    createConnection,
    ErrorCodes,
    FileOperationRegistrationOptions,
    InitializeParams,
    Position,
    ProposedFeatures,
    Range,
    ResponseError,
    TextDocumentSyncKind,
    TextEdit,
    WorkspaceChange,
    WorkspaceEdit,
    WorkspaceFolder,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import { ActiveTextDocuments } from './activeTextDocuments';
import { buildCodeActions } from './codeActions';
import {
    getCompletableSymbolItems,
    getFullCompletionItem,
    getSignatureHelp,
    updateIgnoredCompletionTokens,
} from './completion';
import { getDocumentDiagnostics } from './documentDiagnostics';
import { getDocumentHighlights } from './documentHighlight';
import { getDocumentSymbols } from './documentSymbol';
import { getDocumentSemanticTokens } from './documentTokenSemantics';
import { getReferences, getSymbolReferences } from './references';
import { EAnalyzeOption, UCLanguageServerSettings } from './settings';
import { CommandIdentifier, CommandsList, InlineChangeCommand } from './UC/commands';
import { UCDocument } from './UC/document';
import { TokenModifiers, TokenTypes } from './UC/documentSemanticsBuilder';
import { getDocumentDefinition, getDocumentTooltip, getSymbol, getSymbolDefinition, VALID_ID_REGEXP } from './UC/helpers';
import {
    applyMacroSymbols,
    clearMacroSymbols,
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
    IntrinsicSymbolItemMap,
    queueIndexDocument,
    removeDocumentByPath,
    UCGeneration,
    UELicensee,
} from './UC/indexer';
import { toName } from './UC/name';
import { NAME_ARRAY, NAME_CLASS, NAME_FUNCTION, NAME_NONE } from './UC/names';
import {
    addHashedSymbol,
    CORE_PACKAGE,
    DEFAULT_RANGE,
    IntrinsicArray,
    isClass as isClass,
    isField,
    ISymbol,
    ModifierFlags,
    ObjectsTable,
    supportsRef,
    UCClassSymbol,
    UCMethodSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCPackage,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './UC/Symbols';
import { UnrealPackage } from './UPK/UnrealPackage';
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

let documentFileGlobPattern = "/**/*.{uc,uci}";
let packageFileGlobPattern = "/**/*.{u,upk}";

// FIXME: Use glob pattern, and make the extension configurable.
function isDocumentFileName(fileName: string): boolean {
    // Implied because we only receive one of the two.
    return !isPackageFileName(fileName);
}

function isPackageFileName(fileName: string): boolean {
    return fileName.endsWith('.u');
}

function getFiles(fsPath: string, pattern: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        return glob(pattern, {
            cwd: fsPath,
            root: fsPath,
            realpath: true,
            nosort: true,
            nocase: true,
            nodir: true
        }, (err, matches) => {
            if (err) {
                return reject(err);
            }
            resolve(matches);
        });
    })
}

type WorkspaceFiles = {
    documentFiles: string[];
    packageFiles: string[];
};

async function getWorkspaceFiles(folders: WorkspaceFolder[], reason: string): Promise<WorkspaceFiles> {
    let documentFiles: string[] = [];
    let packageFiles: string[] = [];

    for (let folder of folders) {
        const folderFSPath = URI.parse(folder.uri).fsPath;
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

function registerWorkspaceFiles(workspace: WorkspaceFiles) {
    if (workspace.packageFiles) {
        const packages = workspace.packageFiles
            .map(parsePackageFile);
        Promise.all(packages);
    }

    if (workspace.documentFiles) {
        const documents = registerDocuments(workspace.documentFiles);
        // re-queue all old and new documents.
        pendingDocuments$.next(Array.from(enumerateDocuments()).concat(documents));
    }
}

function unregisterWorkspaceFiles(workspace: WorkspaceFiles) {
    if (workspace.documentFiles) {
        unregisterDocuments(workspace.documentFiles);
    }
}

async function registerWorkspace(folders: WorkspaceFolder[] | null): Promise<void> {
    if (folders) {
        const getStartTime = performance.now();
        const workspace = await getWorkspaceFiles(folders, 'initialize');
        connection.console.log(`Found workspace files in ${(performance.now() - getStartTime) / 1000} seconds!`);

        const registerStartTime = performance.now();
        registerWorkspaceFiles(workspace);
        connection.console.log(`Registered workspace files in ${(performance.now() - registerStartTime) / 1000} seconds!`);
    }
}

function invalidatePendingDocuments() {
    const documents = pendingDocuments$.getValue();
    for (let i = 0; i < documents.length; ++i) {
        documents[i].invalidate();
    }
}

async function awaitDocumentDelivery(uri: DocumentUri): Promise<UCDocument | undefined> {
    const document = getDocumentByURI(uri);
    if (document && document.hasBeenIndexed) {
        return document;
    }

    return firstValueFrom(documentsCodeIndexed$
        .pipe(
            map(docs => {
                const doc = docs.find((d => d.uri === uri));
                return doc;
            }),
            filter(doc => {
                return !!doc!;
            }),
            timeout({
                each: 1000 * 60
            })
        ));
}

async function awaitDocumentBuilt(uri: DocumentUri): Promise<UCDocument | undefined> {
    const document = getDocumentByURI(uri);
    if (document && document.hasBeenBuilt) {
        return document;
    }

    return firstValueFrom(documentBuilt$
        .pipe(
            filter(doc => doc.uri === uri),
            timeout({
                each: 1000 * 60
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
                triggerCharacters: ['(', ',']
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
                commands: CommandsList
            },
            semanticTokensProvider: {
                documentSelector: null,
                full: true,
                range: false,
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
            delay(50),
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
            debounce(({ source }) => interval(source === 'change' ? 50 : undefined))
        )
        .subscribe({
            next: async ({ textDocument, source }) => {
                if (process.env.NODE_ENV === 'development') {
                    connection.console.log(`Processing pending document "${textDocument.uri}":${textDocument.version}, source:${source}.`);
                }
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
                        connection.console.log(`Document "${document.fileName}" is already indexed.`)
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

    const globalsUCIFileName = toName('globals.uci');
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
                    connection.console.info(`Auto-detected generation ${config.generation}.`)
                } else {
                    connection.console.warn(`Auto-detection failed, resorting to UC3.`)
                }
            }

            const indexStartTime = performance.now();
            const work = await connection.window.createWorkDoneProgress();
            work.begin(
                'Indexing workspace',
                0.0,
                'The workspace documents are being processed.',
                true);
            try {
                // TODO: does not respect multiple globals.uci files
                const globalUci = getDocumentById(globalsUCIFileName);
                if (globalUci && !globalUci.hasBeenIndexed) {
                    queueIndexDocument(globalUci);
                }

                // Weird, even if when we have "zero" active documents, this will array is filled?
                const activeDocuments = ActiveTextDocuments
                    .all()
                    .map(doc => getDocumentByURI(doc.uri))
                    .filter(Boolean) as UCDocument[];

                for (let i = activeDocuments.length - 1; i >= 0; i--) {
                    connection.console.log(`Queueing active document "${activeDocuments[i].fileName}".`)
                    work.report(activeDocuments.length / i - 1.0, `${activeDocuments[i].fileName}`);
                    // if (documents[i].hasBeenIndexed) {
                    //     continue;
                    // }

                    if (work.token.isCancellationRequested) {
                        connection.console.warn(`The workspace indexing has been cancelled.`)
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
                            connection.console.warn(`The workspace indexing has been cancelled.`)
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
                isIndexReady$.next(true);
            });

    } else {
        isIndexReady$.next(true);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(async (event) => {
            if (event.added.length) {
                const workspace = await getWorkspaceFiles(event.added, 'workspace files added');
                registerWorkspaceFiles(workspace);
            }

            // FIXME: Doesn't clean up any implicit created packages, nor names.
            if (event.removed.length) {
                const workspace = await getWorkspaceFiles(event.removed, 'workspace files removed');
                unregisterWorkspaceFiles(workspace);
            }
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
        connection.languages.semanticTokens.on(async e => {
            const document = await awaitDocumentDelivery(e.textDocument.uri);
            if (document) {
                return getDocumentSemanticTokens(document);
            }

            return {
                data: []
            };
        });
        // TODO: Support range
        // connection.languages.semanticTokens.onRange(e => getSemanticTokens(e.textDocument.uri));
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

    connection.console.info(`Re-indexing workspace due configuration changes.`)
    isIndexReady$.next(false);
});

function setConfiguration(settings: UCLanguageServerSettings) {
    Object.assign(config, settings);
}

function initializeConfiguration() {
    clearMacroSymbols();
    clearIntrinsicSymbols();
    applyConfiguration(config);
}

function applyConfiguration(settings: UCLanguageServerSettings) {
    applyMacroSymbols(settings.macroSymbols);
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
    // UE3 has Component.uc we can use to determine the generation.
    let document = getDocumentById(toName('Component'));
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
        document = getDocumentById(toName('HelpCommandlet'));
        if (document?.classPackage === CORE_PACKAGE) {
            return UCGeneration.UC1;
        }

        // UE2 / UT2004
        return UCGeneration.UC2;
    }

    // Failed auto
    return undefined;
}

function clearIntrinsicSymbols() {
    // TODO: Implement
}

function installIntrinsicSymbols(intrinsicSymbols: IntrinsicSymbolItemMap) {
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

                const symbol = new UCClassSymbol({ name: symbolName, range: DEFAULT_RANGE });
                symbol.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Generated;
                if (value.extends) {
                    symbol.extendsType = new UCObjectTypeSymbol({ name: toName(value.extends), range: DEFAULT_RANGE }, undefined, UCSymbolKind.Class);
                }
                const pkg = createPackage(pkgNameStr);
                symbol.outer = pkg;
                addHashedSymbol(symbol);
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

                const symbol = new UCMethodSymbol({ name: symbolName, range: DEFAULT_RANGE });
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
        randomizeOrderSymbol = new UCMethodSymbol({ name: randomizeOrderName, range: DEFAULT_RANGE });
        randomizeOrderSymbol.modifiers |= ModifierFlags.Intrinsic;
        IntrinsicArray.addSymbol(randomizeOrderSymbol);
    }
}

function setupFilePatterns(settings: UCLanguageServerSettings) {
    const packageFileExtensions = settings.indexPackageExtensions
        ?.filter(ext => /^\w+$/.test(ext)) // prevent injection
        ?? ['u', 'upk'];
    packageFileGlobPattern = `/**/*.{${packageFileExtensions.join(',')}}`;

    const documentFileExtensions = settings.indexDocumentExtensions
        ?.filter(ext => /^\w+$/.test(ext)) // prevent injection
        ?? ['uc', 'uci'];
    documentFileGlobPattern = `/**/*.{${documentFileExtensions.join(',')}}`;
}

connection.onHover(async (e) => {
    const document = await awaitDocumentDelivery(e.textDocument.uri);
    if (document) {
        return getDocumentTooltip(document, e.position);
    }
});

connection.onDefinition(async (e) => {
    const document = await awaitDocumentDelivery(e.textDocument.uri);
    if (document) {
        return getDocumentDefinition(document, e.position);
    }
});

connection.onReferences((e) => getReferences(e.textDocument.uri, e.position));
connection.onDocumentSymbol(async (e) => {
    const document = await awaitDocumentBuilt(e.textDocument.uri);
    if (document) {
        return getDocumentSymbols(document);
    }
});
connection.onWorkspaceSymbol((e) => {
    return getWorkspaceSymbols(e.query);
});

connection.onDocumentHighlight((e) => getDocumentHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => {
    if (e.context?.triggerKind !== CompletionTriggerKind.Invoked) {
        return firstValueFrom(documentsCodeIndexed$).then(_documents => {
            return getCompletableSymbolItems(e.textDocument.uri, e.position);
        });
    }
    return getCompletableSymbolItems(e.textDocument.uri, e.position);
});
connection.onCompletionResolve(getFullCompletionItem);
connection.onSignatureHelp((e) => getSignatureHelp(e.textDocument.uri, e.position));

connection.onPrepareRename(async (e) => {
    const symbol = getSymbol(e.textDocument.uri, e.position);
    if (!symbol || !(symbol instanceof UCObjectSymbol)) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    const symbolRef: ISymbol | undefined = supportsRef(symbol)
        ? symbol.getRef<UCObjectSymbol>()
        : symbol;

    if (!(symbolRef instanceof UCObjectSymbol)) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Symbol without a defined type e.g. defaultproperties, replication etc.
    if (symbolRef.getTypeKind() === UCTypeKind.Error) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    if (isField(symbolRef)) {
        if (isClass(symbolRef)) {
            throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a class!');
        }
        if (symbolRef.modifiers & ModifierFlags.Intrinsic) {
            throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
        }
    } else {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Disallow symbols with invalid identifiers, such as an operator.
    if (!VALID_ID_REGEXP.test(symbol.getName().text)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'You cannot rename this element!');
    }

    return symbol.id.range;
});

connection.onRenameRequest(async (e) => {
    if (!VALID_ID_REGEXP.test(e.newName)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'Invalid identifier!');
    }

    const symbol = getSymbolDefinition(e.textDocument.uri, e.position);
    if (!symbol) {
        return undefined;
    }

    const references = getSymbolReferences(symbol)
    if (!references) {
        return undefined;
    }

    const changes: { [uri: DocumentUri]: TextEdit[] } = {};
    references.forEach(l => {
        const ranges = changes[l.uri] || (changes[l.uri] = []);
        ranges.push(TextEdit.replace(l.range, e.newName));
    });
    const result: WorkspaceEdit = { changes };
    return result;
});

connection.onCodeAction(e => {
    return buildCodeActions(e.textDocument.uri, e.range);
});

connection.onExecuteCommand(e => {
    switch (e.command) {
        case CommandIdentifier.CreateClass: {
            const uri = e.arguments![0] as DocumentUri;
            const className = e.arguments![1] as string;
            const change = new WorkspaceChange();
            change.createFile(uri, { ignoreIfExists: true });
            change.getTextEditChange({ uri, version: 1 })
                .add({
                    newText: `class ${className} extends Object;`,
                    range: Range.create(Position.create(0, 0), Position.create(0, 0))
                });
            connection.workspace.applyEdit(change.edit);
            // TODO: Need to refresh the document that invoked this command.
            break;
        }

        case CommandIdentifier.Inline: {
            const args = e.arguments![0] as InlineChangeCommand;

            const change = new WorkspaceChange();
            change.getTextEditChange({ uri: args.uri, version: null })
                .replace(
                    args.range,
                    args.newText
                );
            connection.workspace.applyEdit(change.edit);
            break;
        }
    }
});