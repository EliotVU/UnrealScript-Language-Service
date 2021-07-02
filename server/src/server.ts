import * as glob from 'glob';
import * as path from 'path';
import { BehaviorSubject, interval, Subject } from 'rxjs';
import { catchError, debounce, delay, filter, switchMapTo } from 'rxjs/operators';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    createConnection, ErrorCodes, InitializeParams, Location, ProposedFeatures, ResponseError,
    TextDocuments, TextDocumentSyncKind, TextEdit, WorkspaceEdit, WorkspaceFolder
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';

import { EAnalyzeOption, ServerSettings } from './settings';
import { DocumentParseData, UCDocument } from './UC/document';
import {
    getCompletableSymbolItems, getFullCompletionItem, getSymbolDefinition, getSymbolHighlights,
    getSymbolReferences, getSymbols, getSymbolTooltip, VALID_ID_REGEXP
} from './UC/helpers';
import {
    applyMacroSymbols, config, createDocument, createPackage, defaultSettings, documentsMap,
    getDocumentById, getDocumentByURI, getIndexedReferences, getPackageByDir, lastIndexedDocuments$,
    queuIndexDocument, removeDocument
} from './UC/indexer';
import { toName } from './UC/names';
import {
    addHashedSymbol, DEFAULT_RANGE, UCClassSymbol, UCFieldSymbol, UCObjectTypeSymbol, UCSymbol,
    UCTypeFlags
} from './UC/Symbols';

/** Emits true when the workspace is prepared and ready for indexing. */
const isIndexReady$ = new Subject<boolean>();
const documents$ = new BehaviorSubject<UCDocument[]>([]);

/** Emits a document that is pending an update. */
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

const textDocuments = new TextDocuments<TextDocument>(TextDocument);

let hasWorkspaceFolderCapability: boolean = false;
let currentSettings: ServerSettings = defaultSettings;

let activeDocumentParseData: DocumentParseData | undefined;

function getWorkspaceFiles(folders: WorkspaceFolder[]): string[] {
	const flattenedFiles: string[] = [];
	folders
		.map(folder => {
			const folderPath = URI.parse(folder.uri).fsPath;
			return glob.sync(path.join(folderPath, "**/+(*.uc|*.uci)"), { realpath: true });
		})
		.forEach(files => {
			flattenedFiles.push(...files);
		});

	return flattenedFiles;
}

function createDocuments(files: string[]): UCDocument[] {
	return files.map(filePath => createDocument(filePath, getPackageByDir(filePath)));
}

function removeDocuments(files: string[]) {
	for (let filePath of files) {
		removeDocument(filePath);
	}
}


export const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.', '(', '[', ',', '<', '`'],
				resolveProvider: true
			},
			definitionProvider: true,
			documentSymbolProvider: true,
			documentHighlightProvider: true,
			referencesProvider: true,
			renameProvider: {
				prepareProvider: true
			}
		}
	};
});

connection.onInitialized(() => {
	lastIndexedDocuments$
		.pipe(
			filter(() => currentSettings.unrealscript.analyzeDocuments !== EAnalyzeOption.None),
			delay(50),
		)
		.subscribe(documents => {
			if (currentSettings.unrealscript.analyzeDocuments === EAnalyzeOption.OnlyActive) {
				// Only analyze active documents.
				documents = documents.filter(document => textDocuments.get(document.uri))
			}

			for (const document of documents) {
				const diagnostics = document.analyze();
				connection.sendDiagnostics({
					uri: document.uri,
					diagnostics
				});
			}
		}, (error) => connection.console.error(error));

	isIndexReady$
		.pipe(
			filter((value) => !!value),
			switchMapTo(pendingTextDocuments$),
			debounce(() => interval(50)),
			catchError((err, c) => {
				connection.console.error(`Indexing error: '${err}'`);
				return c;
			})
		)
		.subscribe(({ textDocument, isDirty }) => {
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
		});

	documents$
		.pipe(filter(documents => documents.length > 0))
		.subscribe(((documents) => {
			// TODO: does not respect multiple globals.uci files
			const globalUci = getDocumentById(toName('globals.uci'));
			if (globalUci) {
				queuIndexDocument(globalUci);
			}

			if (currentSettings.unrealscript.indexAllDocuments) {
				const indexStartTime = Date.now();
				connection.window.showInformationMessage('Indexing UnrealScript classes!');

				documents.forEach(document => {
					if (document.hasBeenIndexed) {
						return;
					}

					queuIndexDocument(document);
				});

				const time = Date.now() - indexStartTime;
				connection.window.showInformationMessage('UnrealScript classes have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
			} else {
				textDocuments
					.all()
					.forEach(doc => pendingTextDocuments$.next({ textDocument: doc, isDirty: false }));
			}
			isIndexReady$.next(true);
		}));

	if (hasWorkspaceFolderCapability) {
		connection.workspace.getWorkspaceFolders().then((folders) => {
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
	}

	textDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
	textDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
	// We need to re--index the document, incase that the end-user edited a document without saving its changes.
	textDocuments.onDidClose(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
	textDocuments.listen(connection);
});

connection.onDidChangeConfiguration((change) => {
	currentSettings = <ServerSettings>(change.settings);

	Object.assign(config, currentSettings.unrealscript);
	applyMacroSymbols(config.macroSymbols);

	const intSymbols = Object.entries(config.intrinsicSymbols);
	for (let [key, value] of intSymbols) {
		let [pkgNameStr, symbolName] = key.split('.');
		if (value.type === 'class') {
			const pkg = createPackage(pkgNameStr);
			const symbol = new UCClassSymbol({ name: toName(symbolName), range: DEFAULT_RANGE });
			if (value.extends) {
				symbol.extendsType = new UCObjectTypeSymbol({ name: toName(value.extends), range: DEFAULT_RANGE }, undefined, UCTypeFlags.Class);
			}
			symbol.outer = pkg;
			addHashedSymbol(symbol);
		} else {
			console.error('Unsupported symbol type!', value.type, 'try \'class\'!');
		}
	}

	isIndexReady$.next(true);
});

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
	return getCompletableSymbolItems(e.textDocument.uri, activeDocumentParseData, e.position);
});
connection.onCompletionResolve(getFullCompletionItem);

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

	const changes = {};
	locations.forEach(l => {
		const ranges = changes[l.uri] || (changes[l.uri] = []);
		ranges.push(TextEdit.replace(l.range, e.newName));
	});
	const result: WorkspaceEdit = { changes };
	return result;
});

connection.listen();