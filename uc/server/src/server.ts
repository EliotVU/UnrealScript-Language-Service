import { interval, Subject } from 'rxjs';
import { debounce, map, switchMapTo, filter } from 'rxjs/operators';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver';
import URI from 'vscode-uri';

import { initWorkspace, getCompletionItems, getReferences, getDefinition, getSymbols, getHover, getHighlights, getFullCompletionItem } from './UC/helpers';
import { ClassNameToFilePathMap$, getDocumentByUri, indexDocument } from './UC/indexer';
import { UCSettings, defaultSettings } from './settings';

const isIndexReady$ = new Subject<boolean>();
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

let documents: TextDocuments = new TextDocuments();
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let currentSettings: UCSettings = defaultSettings;

export let connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.', '(', '[', ',', '<']
			},
			definitionProvider: true,
			documentSymbolProvider: true,
			documentHighlightProvider: true,
			referencesProvider: true
		}
	};
});

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		initWorkspace(connection);
		connection.workspace.onDidChangeWorkspaceFolders(() => initWorkspace(connection));
	}

	isIndexReady$
		.pipe(
			filter((value) => !!value),
			switchMapTo(pendingTextDocuments$),
			debounce(() => interval(500))
		)
		.subscribe(({ textDocument, isDirty }) => {
			connection.console.log('Validating ' + textDocument.uri + ' dirty? ' + isDirty);

			let document = getDocumentByUri(textDocument.uri);
			try {
				if (isDirty || !document.class) {
					indexDocument(document, textDocument.getText());

					const diagnostics = document.analyze();
					connection.sendDiagnostics({
						uri: document.uri,
						diagnostics
					});
				}

			} catch (err) {
				connection.sendDiagnostics({
					uri: textDocument.uri,
					diagnostics: [
						Diagnostic.create(Range.create(0, 0, 0, 0),
							"Something went wrong while parsing this document! " + err,
							DiagnosticSeverity.Warning,
							undefined,
							'unrealscript')
					]
				});
				return;
			}

			if (!document || document.class === null) {
				connection.sendDiagnostics({
					uri: textDocument.uri,
					diagnostics: [
						Diagnostic.create(Range.create(0, 0, 0, 0),
							"Couldn't validate document!",
							DiagnosticSeverity.Warning,
							undefined,
							'unrealscript')
					]
				});
			}
		}, (error) => {
			connection.console.error(error);
		}
	);

	ClassNameToFilePathMap$
		.pipe(
			map((classesMap) => {
				return Array
					.from(classesMap.values())
					.map(filePath => {
						const uri = URI.file(filePath).toString();
						return uri;
					});
			})
		)
		.subscribe((classes => {
			if (!currentSettings.indexAllDocuments) {
				isIndexReady$.next(true);
				return;
			}

			const indexStartTime = Date.now();
			connection.window.showInformationMessage('Indexing UnrealScript classes!');

			classes.forEach(uri => {
				let document = getDocumentByUri(uri);
				if (!document || document.class) {
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

connection.onDidChangeConfiguration(async () => {
	if (hasConfigurationCapability) {
		currentSettings = await connection.workspace.getConfiguration() || defaultSettings;
		isIndexReady$.next(true);
	}
});

documents.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
documents.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
documents.listen(connection);

connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onHover((e)=> getHover(e.textDocument.uri, e.position));
connection.onDefinition((e)=> getDefinition(e.textDocument.uri, e.position));
connection.onReferences((e) => getReferences(e.textDocument.uri, e.position));
connection.onDocumentHighlight((e) => getHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e) => getCompletionItems(e.textDocument.uri, e.position, e.context));
connection.onCompletionResolve(getFullCompletionItem);
connection.listen();