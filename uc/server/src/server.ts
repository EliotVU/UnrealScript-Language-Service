import { interval, Subject } from 'rxjs';
import { debounce, map, switchMapTo, filter } from 'rxjs/operators';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	Hover,
	Location,
	Diagnostic,
	Definition,
	SymbolInformation,
	DiagnosticSeverity,
	Range,
	DocumentHighlight
} from 'vscode-languageserver';
import URI from 'vscode-uri';

import { initWorkspace, getCompletionItems, getReferences, getDefinition, getSymbols, getHover, getHighlights, getFullCompletionItem } from './UC/helpers';
import { ClassesMap$, getDocumentByUri, indexDocument } from './UC/DocumentListener';

let documents: TextDocuments = new TextDocuments();
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

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
});

interface UCSettings {
}

const documentSettings: Map<string, Thenable<UCSettings>> = new Map();

connection.onDidChangeConfiguration(() => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	}
});

const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

documents.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
documents.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
documents.listen(connection);

connection.onDocumentSymbol((e): Promise<SymbolInformation[]> => getSymbols(e.textDocument.uri));
connection.onHover((e): Promise<Hover> => getHover(e.textDocument.uri, e.position));
connection.onDefinition((e): Promise<Definition> => getDefinition(e.textDocument.uri, e.position));
connection.onReferences((e): Promise<Location[]> => getReferences(e.textDocument.uri, e.position));
connection.onDocumentHighlight((e): Promise<DocumentHighlight[]> => getHighlights(e.textDocument.uri, e.position));
connection.onCompletion((e): Promise<CompletionItem[]> => getCompletionItems(e.textDocument.uri, e.position, e.context));
connection.onCompletionResolve((e): Promise<CompletionItem> => getFullCompletionItem(e));
connection.listen();

ClassesMap$
	.pipe(
		filter(classes => !!classes),
		switchMapTo(pendingTextDocuments$),
		debounce(() => interval(300))
	)
	.subscribe(({ textDocument, isDirty }) => {
		connection.console.log('Validating ' + textDocument.uri + ' dirty? ' + isDirty);

		let document = getDocumentByUri(textDocument.uri);
		try {
			if (isDirty || !document.class) {
				document.invalidate();
				document.parse(textDocument.getText());
				document.link();

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

ClassesMap$
	.pipe(
		map(classesMap => {
			return Array
				.from(classesMap.values())
				.map(filePath => {
					const uri = URI.file(filePath).toString();
					return uri;
				});
		})
	)
	.subscribe((classes => {
		if (classes.length === 0) {
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

		const time = Date.now() - indexStartTime;
		connection.window.showInformationMessage('UnrealScript classes have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
	}));