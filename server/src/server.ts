import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { BehaviorSubject, firstValueFrom, interval, Subject, Subscription } from 'rxjs';
import { debounce, delay, filter, switchMap, tap } from 'rxjs/operators';
import * as url from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    CodeActionKind,
    CompletionTriggerKind,
    createConnection,
    ErrorCodes,
    FileOperationRegistrationOptions,
    InitializeParams,
    Location,
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
    DefaultIgnoredTokensSet,
    getCompletableSymbolItems,
    getFullCompletionItem,
    getSignatureHelp,
    setIgnoredTokensSet,
} from './completion';
import { getDiagnostics } from './diagnostics';
import { getHighlights } from './documentHighlight';
import { getDocumentSymbols } from './documentSymbol';
import { getReferences } from './references';
import { buildSemanticTokens } from './semantics';
import { EAnalyzeOption, UCLanguageServerSettings } from './settings';
import { UCLexer } from './UC/antlr/generated/UCLexer';
import { UCDocument } from './UC/document';
import { TokenModifiers, TokenTypes } from './UC/documentSemanticsBuilder';
import { getSymbol, getSymbolDefinition, getSymbolDocument, getSymbolTooltip, VALID_ID_REGEXP } from './UC/helpers';
import {
    applyMacroSymbols,
    clearMacroSymbols,
    config,
    createDocumentByPath,
    createPackage,
    createPackageByDir,
    enumerateDocuments,
    getDocumentById,
    getDocumentByURI,
    getIndexedReferences,
    IntrinsicSymbolItemMap,
    lastIndexedDocuments$,
    queueIndexDocument,
    removeDocumentByPath,
    UCGeneration,
    UELicensee,
} from './UC/indexer';
import { toName } from './UC/name';
import { NAME_ARRAY, NAME_CLASS, NAME_FUNCTION, NAME_NONE } from './UC/names';
import {
    addHashedSymbol,
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
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasSemanticTokensCapability = false;

let documentFileGlobPattern = "**/*.{uc,uci}";
let packageFileGlobPattern = "**/*.{u,upk}";

// FIXME: Use glob pattern, and make the extension configurable.
function isDocumentFileName(fileName: string): boolean {
    // Implied because we only receive one of the two.
    return !isPackageFileName(fileName);
}

function isPackageFileName(fileName: string): boolean {
    return fileName.endsWith('.u');
}

function getFiles(fsPath: string, pattern: string): string[] {
    return glob.sync(pattern, {
        root: fsPath,
        realpath: true,
        nosort: true,
        nocase: true
    });
}

type WorkspaceFiles = {
    documentFiles: string[];
    packageFiles: string[];
};

function getWorkspaceFiles(folders: WorkspaceFolder[], reason: string): WorkspaceFiles {
    const documentFiles: string[] = [];
    const packageFiles: string[] = [];

    for (let folder of folders) {
        const folderFSPath = URI.parse(folder.uri).fsPath;
        connection.console.info(`Scanning folder '${folderFSPath}' using pattern '${packageFileGlobPattern}', '${documentFileGlobPattern}'`);
        documentFiles.push(...getFiles(folderFSPath, documentFileGlobPattern));
        packageFiles.push(...getFiles(folderFSPath, packageFileGlobPattern));
    }
    connection.console.info(`(${reason}) Found '${documentFiles.length}' document files`);
    connection.console.info(`(${reason}) Found '${packageFiles.length}' package files`);
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

function invalidatePendingDocuments() {
    const documents = pendingDocuments$.getValue();
    for (let i = 0; i < documents.length; ++i) {
        documents[i].invalidate();
    }
}

async function awaitDocumentDelivery(uri: string): Promise<UCDocument | undefined> {
    const document = getDocumentByURI(uri);
    if (document && document.hasBeenIndexed) {
        return document;
    }

    return firstValueFrom(lastIndexedDocuments$).then(documents => {
        return documents.find((d) => d.uri === uri);
    });
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
        initializeWorkspace([{
            uri: params.rootUri,
            name: 'default'
        }]);
    }

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
                commands: [
                    'create.class'
                ]
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
    lastIndexedDocumentsSub = lastIndexedDocuments$
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
                    const diagnostics = getDiagnostics(document);
                    connection.sendDiagnostics({
                        uri: document.uri,
                        diagnostics
                    });
                } catch (error) {
                    connection.console.error(`Analysis of document '${document.uri}' threw '${error}'`);
                }
            }
        });

    isIndexReadySub = isIndexReady$
        .pipe(
            switchMap(() => pendingTextDocuments$),
            debounce(() => interval(50))
        )
        .subscribe({
            next: ({ textDocument, isDirty }) => {
                const document = getDocumentByURI(textDocument.uri);
                if (!document) {
                    // Don't index documents that are not part of the workspace.
                    return;
                }

                if (isDirty) {
                    document.invalidate();
                }

                if (!document.hasBeenIndexed) {
                    queueIndexDocument(document, textDocument.getText());
                }
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
            const indexStartTime = performance.now();
            const work = await connection.window.createWorkDoneProgress();
            work.begin('Indexing workspace', 0.0);
            try {
                // TODO: does not respect multiple globals.uci files
                const globalUci = getDocumentById(globalsUCIFileName);
                if (globalUci) {
                    queueIndexDocument(globalUci);
                }

                if (config.indexAllDocuments) {
                    for (let i = 0; i < documents.length; i++) {
                        if (documents[i].hasBeenIndexed) {
                            continue;
                        }

                        work.report(i / documents.length, `${documents[i].fileName} + dependencies`);
                        queueIndexDocument(documents[i]);
                    }
                } else {
                    ActiveTextDocuments
                        .all()
                        .forEach(doc => pendingTextDocuments$.next({
                            textDocument: doc,
                            isDirty: false
                        }));
                }
            } finally {
                work.done();

                const time = performance.now() - indexStartTime;
                connection.console.log('UnrealScript documents have been indexed in ' + (time / 1000) + ' seconds!');
            }
        }));

    if (hasConfigurationCapability) {
        connection.workspace
            .getConfiguration('unrealscript')
            .then((settings: UCLanguageServerSettings) => {
                setConfiguration(settings);
                initializeConfiguration();
                return connection.workspace.getWorkspaceFolders();
            })
            .then((workspaceFolders) => {
                initializeWorkspace(workspaceFolders);
                isIndexReady$.next(true);
            });

    } else {
        isIndexReady$.next(true);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
            if (event.added.length) {
                const workspace = getWorkspaceFiles(event.added, 'workspace files added');
                registerWorkspaceFiles(workspace);
            }

            // FIXME: Doesn't clean up any implicit created packages, nor names.
            if (event.removed.length) {
                const workspace = getWorkspaceFiles(event.removed, 'workspace files removed');
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
        connection.languages.semanticTokens.on(e => {
            const document = getDocumentByURI(e.textDocument.uri);
            if (!document) {
                return {
                    data: []
                };
            }

            if (!document.hasBeenIndexed) {
                return firstValueFrom(lastIndexedDocuments$).then(() => {
                    return buildSemanticTokens(document);
                });
            }
            return buildSemanticTokens(document);
        });
        // TODO: Support range
        // connection.languages.semanticTokens.onRange(e => getSemanticTokens(e.textDocument.uri));
    }

    ActiveTextDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
    ActiveTextDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
    // We need to re--index the document, incase that the end-user edited a document without saving its changes.
    ActiveTextDocuments.onDidClose(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
    ActiveTextDocuments.listen(connection);
});

connection.onDidChangeConfiguration((params: { settings: { unrealscript: UCLanguageServerSettings } }) => {
    setConfiguration(params.settings.unrealscript);
    initializeConfiguration();
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
    setupIgnoredTokens(settings.generation);
    setupFilePatterns(settings);
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
                symbol.modifiers |= ModifierFlags.Intrinsic;
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
                symbol.modifiers |= ModifierFlags.Intrinsic;
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
        IntrinsicArray.addSymbol(randomizeOrderSymbol);
    }
}

function setupIgnoredTokens(generation: UCGeneration) {
    const ignoredTokensSet = new Set(DefaultIgnoredTokensSet);
    if (generation === UCGeneration.UC1) {
        ignoredTokensSet.add(UCLexer.KW_EXTENDS);
        ignoredTokensSet.add(UCLexer.KW_NATIVE);

        // TODO: Context aware ignored tokens.
        // ignoredTokensSet.add(UCLexer.KW_TRANSIENT);
        ignoredTokensSet.add(UCLexer.KW_LONG);
    } else {
        ignoredTokensSet.add(UCLexer.KW_EXPANDS);
        ignoredTokensSet.add(UCLexer.KW_INTRINSIC);
    }

    if (generation === UCGeneration.UC3) {
        ignoredTokensSet.add(UCLexer.KW_CPPSTRUCT);
    } else {
        // Some custom UE2 builds do have implements and interface
        ignoredTokensSet.add(UCLexer.KW_IMPLEMENTS);
        ignoredTokensSet.add(UCLexer.KW_INTERFACE);

        ignoredTokensSet.add(UCLexer.KW_STRUCTDEFAULTPROPERTIES);
        ignoredTokensSet.add(UCLexer.KW_STRUCTCPPTEXT);

        ignoredTokensSet.add(UCLexer.KW_ATOMIC);
        ignoredTokensSet.add(UCLexer.KW_ATOMICWHENCOOKED);
        ignoredTokensSet.add(UCLexer.KW_STRICTCONFIG);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLE);
        ignoredTokensSet.add(UCLexer.KW_IMMUTABLEWHENCOOKED);
    }
    setIgnoredTokensSet(ignoredTokensSet);
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

function initializeWorkspace(folders: WorkspaceFolder[] | null) {
    if (folders) {
        const workspace = getWorkspaceFiles(folders, 'initialize');
        registerWorkspaceFiles(workspace);
    }
}

connection.onHover(async (e) => {
    await awaitDocumentDelivery(e.textDocument.uri);
    return getSymbolTooltip(e.textDocument.uri, e.position);
});

connection.onDefinition(async (e) => {
    await awaitDocumentDelivery(e.textDocument.uri);
    const symbol = getSymbolDefinition(e.textDocument.uri, e.position);
    if (symbol) {
        const document = getSymbolDocument(symbol);
        const documentUri = document?.uri;
        return documentUri
            ? Location.create(documentUri, symbol.id.range)
            : undefined;
    }
    return undefined;
});

connection.onReferences((e) => getReferences(e.textDocument.uri, e.position));
connection.onDocumentSymbol((e) => {
    return getDocumentSymbols(e.textDocument.uri);
});
connection.onWorkspaceSymbol((e) => {
    return getWorkspaceSymbols(e.query);
});

connection.onDocumentHighlight((e) => getHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => {
    if (e.context?.triggerKind !== CompletionTriggerKind.Invoked) {
        return firstValueFrom(lastIndexedDocuments$).then(_documents => {
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
    const references = getIndexedReferences(symbol.getHash());
    const locations = references && Array
        .from(references.values())
        .map(ref => ref.location);

    if (!locations) {
        return undefined;
    }

    const changes: { [uri: string]: TextEdit[] } = {};
    locations.forEach(l => {
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
        case 'create.class': {
            const uri = e.arguments![0] as string;
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
    }
});