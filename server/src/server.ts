import * as path from 'path';
import * as glob from 'glob';

import { interval, Subject } from 'rxjs';
import { debounce, map, switchMapTo, filter, delay } from 'rxjs/operators';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	ProposedFeatures,
	InitializeParams,
	WorkspaceFolder,
	WorkspaceEdit,
	TextEdit,
	ResponseError,
	ErrorCodes,
	Location,
	SymbolKind,
	CompletionTriggerKind
} from 'vscode-languageserver';
import URI from 'vscode-uri';

import { getSymbolItems, getSymbolReferences, getSymbolDefinition, getSymbols, getSymbolTooltip, getSymbolHighlights, getFullCompletionItem } from './UC/helpers';
import { filePathByClassIdMap$, getDocumentByUri, indexDocument, getIndexedReferences, config } from './UC/indexer';
import { ServerSettings, defaultSettings } from './settings';
import { documentLinked$ } from './UC/document';
import { UCClassSymbol, UCFieldSymbol, DEFAULT_RANGE, UCSymbol } from './UC/Symbols';

const isIndexReady$ = new Subject<boolean>();
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

let textDocuments: TextDocuments = new TextDocuments();
let hasWorkspaceFolderCapability: boolean = false;
let currentSettings: ServerSettings = defaultSettings;

export let connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: textDocuments.syncKind,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.', '(', '[', ',', '<'],
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

connection.onInitialized(async () => {
	if (hasWorkspaceFolderCapability) {
		async function buildClassesMapFromFolders(folders: WorkspaceFolder[]) {
			const pathsMap = new Map<string, string>();

			for (let folder of folders) {
				const folderPath = URI.parse(folder.uri).fsPath;
				try {
					const files = glob.sync(path.join(folderPath, "**/*.uc"));
					for (let file of files) {
						pathsMap.set(path.basename(file, '.uc').toLowerCase(), file);
					}
				} catch (exc) {
					connection.console.error(exc.toString());
				}
			}
			return pathsMap;
		}

		const folders = await connection.workspace.getWorkspaceFolders();
		if (folders) {
			const map = await buildClassesMapFromFolders(folders);
			filePathByClassIdMap$.next(map);
		} else {
			connection.console.warn("No workspace folders!");
		}

		connection.workspace.onDidChangeWorkspaceFolders(async (e) => {
			const folders = e.added;
			if (folders.length > 0) {
				const classesFilePathsMap = await buildClassesMapFromFolders(folders);
				const mergedMap = new Map<string, string>([...filePathByClassIdMap$.getValue(), ...classesFilePathsMap]);
				filePathByClassIdMap$.next(mergedMap);
			}
		});
	}

	documentLinked$
		.pipe(
			filter(() => !!currentSettings.unrealscript.analyzeDocuments),
			delay(1000),
		)
		.subscribe(document => {
			if (document) {
				const diagnostics = document.analyze();
				connection.sendDiagnostics({
					uri: document.filePath,
					diagnostics
				});
			}
		}, (error) => connection.console.error(error));

	isIndexReady$
		.pipe(
			filter((value) => !!value),
			switchMapTo(pendingTextDocuments$),
			debounce(() => interval(200))
		)
		.subscribe(({ textDocument, isDirty }) => {
			const document = getDocumentByUri(textDocument.uri);
			console.assert(document, 'Failed to fetch document at: ' + textDocument.uri);

			if (isDirty || !document.class) {
				indexDocument(document, textDocument.getText());
			}
		}, (error) => connection.console.error(error));

	filePathByClassIdMap$
		.pipe(
			filter(classesMap => !!classesMap),
			map((classesMap) => {
				return Array
					.from(classesMap.values())
					.map(filePath => {
						const uri = URI.file(filePath).toString();
						return uri;
					});
			})
		)
		.subscribe(((classes) => {
			if (!currentSettings.unrealscript.indexAllDocuments) {
				isIndexReady$.next(true);
				const openDocuments = textDocuments.all();
				openDocuments.forEach(doc => {
					pendingTextDocuments$.next({ textDocument: doc, isDirty: false });
				});
				return;
			}

			const indexStartTime = Date.now();
			connection.window.showInformationMessage('Indexing UnrealScript classes!');

			const documents = classes.map(uri => getDocumentByUri(uri));
			documents.forEach(document => {
				// Already indexed!
				if (document.class) {
					return;
				}

				indexDocument(document);
			});

			isIndexReady$.next(true);

			const time = Date.now() - indexStartTime;
			connection.window.showInformationMessage('UnrealScript classes have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
		})
	);
});

connection.onDidChangeConfiguration((change) => {
	currentSettings = <ServerSettings>(change.settings);
	Object.assign(config, currentSettings.unrealscript);
	isIndexReady$.next(true);
});

textDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
textDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
textDocuments.listen(connection);

connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onHover((e)=> getSymbolTooltip(e.textDocument.uri, e.position));

connection.onDefinition(async (e)=> {
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

connection.onCompletion(async (e) => {
	let position = e.position;
	if (e.context) {
		if (e.context.triggerKind <= CompletionTriggerKind.TriggerCharacter) {
			const doc = textDocuments.get(e.textDocument.uri);
			if (!doc) {
				return undefined;
			}

			const text = doc.getText();
			for (let colOffset = doc.offsetAt(position); colOffset >= 0; -- colOffset) {
				const char = text[colOffset];
				if (char === ' ' || char === '\t' || char === '\n' || char === '.') {
					continue;
				}
				position = doc.positionAt(colOffset);
				break;
			}
		}
	}
	return getSymbolItems(e.textDocument.uri, position);
});
connection.onCompletionResolve(getFullCompletionItem);

connection.onPrepareRename(async (e) => {
	const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
	if (!symbol) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol instanceof UCFieldSymbol) {
		if (symbol instanceof UCClassSymbol) {
			throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a class!');
		}
	} else {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol.id.range === DEFAULT_RANGE) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol.getKind() === SymbolKind.Constructor) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a constructor!');
	}

	// Disallow symbols with invalid identifiers, such as an operator.
	if (!VALID_ID_REGEXP.test(symbol.getId().toString())){
		throw new ResponseError(ErrorCodes.InvalidParams, 'You cannot rename this element!');
	}

	return symbol.id.range;
});

const VALID_ID_REGEXP = RegExp(/^([a-zA-Z_][a-zA-Z_0-9]*)$/);
connection.onRenameRequest(async (e) => {
	if (!VALID_ID_REGEXP.test(e.newName)){
		throw new ResponseError(ErrorCodes.InvalidParams, 'Invalid identifier!');
	}

	const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
	if (!symbol || !(symbol instanceof UCSymbol)) {
		return undefined;
	}
	const qualifiedName = symbol.getQualifiedName();
	const references = getIndexedReferences(qualifiedName);
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
	const result: WorkspaceEdit = {changes};
	return result;
});

connection.listen();