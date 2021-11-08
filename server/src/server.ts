import * as glob from 'glob';
import * as path from 'path';
import { BehaviorSubject, firstValueFrom, from, interval, Subject, Subscription } from 'rxjs';
import { debounce, delay, filter, switchMapTo, tap } from 'rxjs/operators';
import * as url from 'url';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    CodeActionKind, CompletionTriggerKind, createConnection, ErrorCodes,
    FileOperationRegistrationOptions, InitializeParams, Location, Position, ProposedFeatures, Range,
    ResponseError, TextDocuments, TextDocumentSyncKind, TextEdit, WorkspaceChange, WorkspaceEdit,
    WorkspaceFolder
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import {
    DefaultIgnoredTokensSet, getCompletableSymbolItems, getFullCompletionItem, getSignatureHelp,
    setIgnoredTokensSet
} from './completion';
import { EAnalyzeOption, IntrinsicSymbolItemMap, UCLanguageServerSettings } from './settings';
import { UCLexer } from './UC/antlr/generated/UCLexer';
import { DocumentParseData, UCDocument } from './UC/document';
import {
    getCodeActions, getSymbolDefinition, getSymbolHighlights, getSymbolReferences, getSymbols,
    getSymbolTooltip, VALID_ID_REGEXP
} from './UC/helpers';
import {
    applyMacroSymbols, clearMacroSymbols, config, createDocumentByPath, createPackage, documentsMap,
    getDocumentById, getDocumentByURI, getIndexedReferences, getPackageByDir, lastIndexedDocuments$,
    queuIndexDocument, removeDocumentByPath, UCGeneration
} from './UC/indexer';
import { toName } from './UC/names';
import {
    addHashedSymbol, DEFAULT_RANGE, ObjectsTable, UCClassSymbol, UCFieldSymbol, UCObjectTypeSymbol,
    UCSymbol, UCTypeFlags
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

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

let activeDocumentParseData: DocumentParseData | undefined;

const UCFileGlobPattern = "**/*.{uc,uci}";

function getWorkspaceFiles(folders: WorkspaceFolder[]): string[] {
    const flattenedFiles: string[] = [];
    folders
        .map(folder => {
            const folderFSPath = URI.parse(folder.uri).fsPath;
            const pattern = path.join(folderFSPath, UCFileGlobPattern);
            return glob.sync(pattern, { realpath: true });
        })
        .forEach(files => {
            flattenedFiles.push(...files);
        });

    return flattenedFiles;
}

function createDocuments(files: string[]): UCDocument[] {
    return files.map(filePath => createDocumentByPath(filePath, getPackageByDir(filePath)));
}

function removeDocuments(files: string[]) {
    for (let filePath of files) {
        removeDocumentByPath(filePath);
    }
}

export const connection = createConnection(ProposedFeatures.all);

let lastIndexedDocumentsSub: Subscription;
let isIndexReadySub: Subscription;
let documentsSub: Subscription;

connection.onShutdown(() => {
    lastIndexedDocumentsSub.unsubscribe();
    isIndexReadySub.unsubscribe();
    documentsSub.unsubscribe();
});

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

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
                triggerCharacters: ['(', ',', '<']
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
                documents = documents.filter(document => textDocuments.get(document.uri))
            }

            for (const document of documents) {
                try {
                    const diagnostics = document.analyze();
                    connection.sendDiagnostics({
                        uri: document.uri,
                        diagnostics
                    });
                } catch (error) {
                    connection.console.error(`Analyzation of document '${document.uri}' threw '${error}'`);
                }
            }
        });

    isIndexReadySub = isIndexReady$
        .pipe(
            switchMapTo(pendingTextDocuments$),
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
                    const parser = queuIndexDocument(document, textDocument.getText());
                    if (textDocuments.get(textDocument.uri)) {
                        activeDocumentParseData = parser;
                    }
                }
            },
            error: err => {
                connection.console.error(`Index queu error: '${err}'`);
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
            switchMapTo(documents$),
            filter(documents => documents.length > 0)
        )
        .subscribe(((documents) => {
            // TODO: does not respect multiple globals.uci files
            const globalUci = getDocumentById(globalsUCIFileName);
            if (globalUci) {
                queuIndexDocument(globalUci);
            }

            if (config.indexAllDocuments) {
                const indexStartTime = Date.now();
                connection.window.showInformationMessage('Indexing UnrealScript documents!');

                documents.forEach(document => {
                    if (document.hasBeenIndexed) {
                        return;
                    }

                    queuIndexDocument(document);
                });

                const time = Date.now() - indexStartTime;
                connection.window.showInformationMessage('UnrealScript documents have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
            } else {
                textDocuments
                    .all()
                    .forEach(doc => pendingTextDocuments$.next({ textDocument: doc, isDirty: false }));
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
        connection.workspace
            .getWorkspaceFolders()
            .then((folders) => {
                if (folders) {
                    const files = getWorkspaceFiles(folders);
                    if (files) {
                        const documents = createDocuments(files);
                        documents$.next(documents);
                    }
                }
            });

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
                    queuIndexDocument(document);
                });
        });

        connection.workspace.onDidRenameFiles(params => {
            const oldFiles = params.files.map(f => url.fileURLToPath(f.oldUri));
            // TODO: Need to trigger a re-index event for all documents that have a dependency on these files.
            removeDocuments(oldFiles);

            const newFiles = params.files.map(f => url.fileURLToPath(f.newUri));
            createDocuments(newFiles)
                .forEach(document => {
                    queuIndexDocument(document);
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
    for (let [key, value] of intSymbols) {
        let [pkgNameStr, symbolName] = key.split('.');
        if (value.type === 'class') {
            const classSymbolName = toName(symbolName);
            if (ObjectsTable.getSymbol(classSymbolName, UCTypeFlags.Class)) {
                continue;
            }

            const pkg = createPackage(pkgNameStr);
            const symbol = new UCClassSymbol({ name: classSymbolName, range: DEFAULT_RANGE });
            if (value.extends) {
                symbol.extendsType = new UCObjectTypeSymbol({ name: toName(value.extends), range: DEFAULT_RANGE }, undefined, UCTypeFlags.Class);
            }
            symbol.outer = pkg;
            addHashedSymbol(symbol);
        } else {
            console.error('Unsupported symbol type!', value.type, 'try \'class\'!');
        }
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
        // Some custom UE2 builds do have implements
        ignoredTokensSet.add(UCLexer.KW_IMPLEMENTS);

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

connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onHover((e) => getSymbolTooltip(e.textDocument.uri, e.position));

connection.onDefinition(async (e) => {
    const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
    if (symbol instanceof UCSymbol) {
        const uri = symbol.getUri();
        // This shouldn't happen, except for non UCSymbol objects.
        if (!uri) {
            return undefined;
        }
        return Location.create(uri, symbol.id.range);
    }
    return undefined;
});

connection.onReferences((e) => getSymbolReferences(e.textDocument.uri, e.position));
connection.onDocumentHighlight((e) => getSymbolHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => {
    if (e.context?.triggerKind !== CompletionTriggerKind.Invoked) {
        return firstValueFrom(lastIndexedDocuments$).then(documents => {
            return getCompletableSymbolItems(e.textDocument.uri, activeDocumentParseData, e.position);
        });
    }
    return getCompletableSymbolItems(e.textDocument.uri, activeDocumentParseData, e.position);
});
connection.onCompletionResolve(getFullCompletionItem);
connection.onSignatureHelp((e) => getSignatureHelp(e.textDocument.uri, activeDocumentParseData, e.position));

connection.onPrepareRename(async (e) => {
    const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
    if (!symbol) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Symbol without a defined type e.g. defaultproperties, replication etc.
    if (symbol.getTypeFlags() === UCTypeFlags.Error) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    if (symbol instanceof UCFieldSymbol) {
        if (symbol instanceof UCClassSymbol) {
            throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a class!');
        }
    } else {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Intrinsic type?
    if (symbol.id.range === DEFAULT_RANGE) {
        throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
    }

    // Disallow symbols with invalid identifiers, such as an operator.
    if (!VALID_ID_REGEXP.test(symbol.getName().toString())) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'You cannot rename this element!');
    }

    return symbol.id.range;
});

connection.onRenameRequest(async (e) => {
    if (!VALID_ID_REGEXP.test(e.newName)) {
        throw new ResponseError(ErrorCodes.InvalidParams, 'Invalid identifier!');
    }

    const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
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
    return getCodeActions(e.textDocument.uri, e.range);
});

connection.onExecuteCommand(e => {
    switch (e.command) {
        case 'create.class':
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
});

connection.listen();