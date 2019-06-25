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
	WorkspaceFolder
} from 'vscode-languageserver';
import URI from 'vscode-uri';

import { getCompletionItems, getReferences, getDefinition, getSymbols, getHover, getHighlights, getFullCompletionItem } from './UC/helpers';
import { filePathByClassIdMap$, getDocumentByUri, indexDocument } from './UC/indexer';
import { UCSettings, defaultSettings } from './settings';
import { documentLinked$ } from './UC/document';

const isIndexReady$ = new Subject<boolean>();
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

let textDocuments: TextDocuments = new TextDocuments();
let hasWorkspaceFolderCapability: boolean = false;
let currentSettings: UCSettings = defaultSettings;

export let connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: textDocuments.syncKind,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.', '(', '[', ',', '<']
			},
			definitionProvider: true,
			documentSymbolProvider: true,
			documentHighlightProvider: true,
			referencesProvider: true,
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

				connection.console.log("Indexing file " + document.fileName);
				indexDocument(document);
			});

			isIndexReady$.next(true);

			const time = Date.now() - indexStartTime;
			connection.window.showInformationMessage('UnrealScript classes have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
		})
	);
});

connection.onDidChangeConfiguration((change) => {
	currentSettings = <UCSettings>(change.settings);
	isIndexReady$.next(true);
});

textDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
textDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
textDocuments.listen(connection);

connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onHover((e)=> getHover(e.textDocument.uri, e.position));
connection.onDefinition((e)=> getDefinition(e.textDocument.uri, e.position));
connection.onReferences((e) => getReferences(e.textDocument.uri, e.position));
connection.onDocumentHighlight((e) => getHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => getCompletionItems(e.textDocument.uri, e.position, e.context));
connection.onCompletionResolve(getFullCompletionItem);
connection.listen();