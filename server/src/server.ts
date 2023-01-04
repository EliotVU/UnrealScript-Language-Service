import * as glob from 'glob';
import { performance } from 'perf_hooks';
import { BehaviorSubject, firstValueFrom, interval, Subject, Subscription } from 'rxjs';
import { debounce, delay, filter, switchMap, tap } from 'rxjs/operators';
import * as url from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    CodeActionKind, CompletionTriggerKind, createConnection, ErrorCodes,
    FileOperationRegistrationOptions, InitializeParams, Location, Position, ProposedFeatures, Range,
    ResponseError, TextDocuments, TextDocumentSyncKind, TextEdit, WorkspaceChange, WorkspaceEdit,
    WorkspaceFolder
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import { buildCodeActions } from './codeActions';
import {
    DefaultIgnoredTokensSet, getCompletableSymbolItems, getFullCompletionItem, getSignatureHelp,
    setIgnoredTokensSet
} from './completion';
import { getDiagnostics } from './diagnostics';
import { getHighlights } from './documentHighlight';
import { getSymbols } from './documentSymbol';
import { getReferences } from './references';
import { buildSemanticTokens } from './semantics';
import { EAnalyzeOption, UCLanguageServerSettings } from './settings';
import { UCLexer } from './UC/antlr/generated/UCLexer';
import { DocumentParseData, UCDocument } from './UC/document';
import { TokenModifiers, TokenTypes } from './UC/documentSemanticsBuilder';
import {
    getSymbol, getSymbolDefinition, getSymbolDocument, getSymbolTooltip, VALID_ID_REGEXP
} from './UC/helpers';
import {
    applyMacroSymbols, clearMacroSymbols, config, createDocumentByPath, createPackage, documentsMap,
    getDocumentById, getDocumentByURI, getIndexedReferences, getPackageByDir,
    IntrinsicSymbolItemMap, lastIndexedDocuments$, queueIndexDocument, removeDocumentByPath,
    UCGeneration, UELicensee
} from './UC/indexer';
import { toName } from './UC/name';
import { NAME_ARRAY, NAME_CLASS, NAME_FUNCTION, NAME_NONE } from './UC/names';
import {
    addHashedSymbol, DEFAULT_RANGE, IntrinsicArray, isClass as isClass, isField, ISymbol,
    ModifierFlags, ObjectsTable, supportsRef, UCClassSymbol, UCMethodSymbol, UCObjectSymbol,
    UCObjectTypeSymbol, UCStructSymbol, UCSymbolKind, UCTypeKind
} from './UC/Symbols';

/**
 * Emits true when the workspace is prepared and ready for indexing.
 * If false, the workspace is expected to be invalidated and re-indexed.
 **/
const isIndexReady$ = new Subject<boolean>();
const documents$ = new BehaviorSubject<UCDocument[]>([]);

/** Emits a document that is pending an update. */
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

const textDocuments = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasSemanticTokensCapability = false;

let activeDocumentParseData: DocumentParseData | undefined;

const UCFileGlobPattern = "**/*.{uc,uci}";

function getWorkspaceFiles(folders: WorkspaceFolder[]): string[] {
    const flattenedFiles: string[] = [];
    folders
        .map(folder => {
            const folderFSPath = URI.parse(folder.uri).fsPath;
            connection.console.info(`Scanning using pattern '${UCFileGlobPattern}'`);
            return glob.sync(UCFileGlobPattern, {
                root: folderFSPath,
                realpath: true,
                nosort: true,
                nocase: true
            });
        })
        .forEach(files => {
            connection.console.info(`Found '${files.length}' matching files`);
            flattenedFiles.push(...files);
        });

    return flattenedFiles;
}

function createDocuments(files: string[]): UCDocument[] {
    return files.map(filePath => createDocumentByPath(filePath, getPackageByDir(filePath)));
}

function removeDocuments(files: string[]) {
    for (const filePath of files) {
        removeDocumentByPath(filePath);
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

    const fileOperation: FileOperationRegistrationOptions = {
        filters: [{
            scheme: 'file',
            pattern: {
                glob: UCFileGlobPattern,
                options: {
                    ignoreCase: true
                }
            }
        }]
    };

    const folders = params.workspaceFolders;
    if (folders) {
        const files = getWorkspaceFiles(folders);
        if (files) {
            const documents = createDocuments(files);
            documents$.next(documents);
        }
    }

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

connection.onInitialized(() => {
    lastIndexedDocumentsSub = lastIndexedDocuments$
        .pipe(
            filter(() => config.analyzeDocuments !== EAnalyzeOption.None),
            delay(50),
        )
        .subscribe(documents => {
            if (config.analyzeDocuments === EAnalyzeOption.OnlyActive) {
                // Only analyze active documents.
                documents = documents.filter(document => textDocuments.get(document.uri));
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
                    const parser = queueIndexDocument(document, textDocument.getText());
                    if (textDocuments.get(textDocument.uri)) {
                        activeDocumentParseData = parser;
                    }
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

                const documents = documents$.getValue();
                for (let i = 0; i < documents.length; ++i) {
                    documents[i].invalidate();
                }
            }),
            switchMap(() => documents$),
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
                    textDocuments
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
                isIndexReady$.next(true);
            });

    } else {
        // Using the default settings.
        initializeConfiguration();
        isIndexReady$.next(true);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
            if (event.added) {
                const files = getWorkspaceFiles(event.added);
                if (files) {
                    createDocuments(files);
                    documents$.next(Array.from(documentsMap.values()));
                }
            }

            // FIXME: Doesn't clean up any implicit created packages, nor names.
            if (event.removed) {
                const files = getWorkspaceFiles(event.removed);
                if (files) {
                    removeDocuments(files);
                    documents$.next(Array.from(documentsMap.values()));
                }
            }
        });

        connection.workspace.onDidCreateFiles(params => {
            const newFiles = params.files.map(f => url.fileURLToPath(f.uri));
            createDocuments(newFiles)
                .forEach(document => {
                    queueIndexDocument(document);
                });
        });

        connection.workspace.onDidRenameFiles(params => {
            const oldFiles = params.files.map(f => url.fileURLToPath(f.oldUri));
            // TODO: Need to trigger a re-index event for all documents that have a dependency on these files.
            removeDocuments(oldFiles);

            const newFiles = params.files.map(f => url.fileURLToPath(f.newUri));
            createDocuments(newFiles)
                .forEach(document => {
                    queueIndexDocument(document);
                });
        });

        connection.workspace.onDidDeleteFiles(params => {
            const files = params.files.map(f => url.fileURLToPath(f.uri));
            // TODO: Need to trigger a re-index event for all documents that have a dependency on these files.
            removeDocuments(files);
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

    textDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
    textDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
    // We need to re--index the document, incase that the end-user edited a document without saving its changes.
    textDocuments.onDidClose(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
    textDocuments.listen(connection);
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
connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onDocumentHighlight((e) => getHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => {
    if (e.context?.triggerKind !== CompletionTriggerKind.Invoked) {
        return firstValueFrom(lastIndexedDocuments$).then(_documents => {
            return getCompletableSymbolItems(e.textDocument.uri, activeDocumentParseData, e.position);
        });
    }
    return getCompletableSymbolItems(e.textDocument.uri, activeDocumentParseData, e.position);
});
connection.onCompletionResolve(getFullCompletionItem);
connection.onSignatureHelp((e) => getSignatureHelp(e.textDocument.uri, activeDocumentParseData, e.position));

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

connection.listen();