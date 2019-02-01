import { interval, Subject } from 'rxjs';
import { debounce } from 'rxjs/operators';

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
	Range
} from 'vscode-languageserver';

import { initWorkspace, getDocumentListenerByUri, getCompletionItems, getReferences, getDefinition, getSymbols, getHover } from './UC/helpers';

let documents: TextDocuments = new TextDocuments();
let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

let connection = createConnection(ProposedFeatures.all);
connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.']
			},
			definitionProvider: true,
			documentSymbolProvider: true,
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

let documentSettings: Map<string, Thenable<UCSettings>> = new Map();

connection.onDidChangeConfiguration(() => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	}
});

const pendingDocuments$ = new Subject<TextDocument>();
pendingDocuments$
	.pipe(debounce(() => interval(300)))
	.subscribe(document => {
		validateTextDocument(document);
	});

function validateTextDocument(textDocument: TextDocument): Promise<void> {
	connection.console.log('Validating' + textDocument.uri);

	let document = getDocumentListenerByUri(textDocument.uri);

	try {
		document.invalidate();
		document.parse(textDocument.getText());
		document.link();
	} catch (err) {
		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: [Diagnostic.create(Range.create(0, 0, 0, 0), "Something went wrong while parsing this document! " + err, DiagnosticSeverity.Warning, undefined, 'unrealscript')]
		});
		return;
	}

	if (!document || document.class === null) {
		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: [Diagnostic.create(Range.create(0, 0, 0, 0), "Couldn't validate document!", DiagnosticSeverity.Warning, undefined, 'unrealscript')]
		});
		return;
	}

	const diagnostics = document.analyze();
	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics
	});
}

documents.onDidOpen(e => pendingDocuments$.next(e.document));
documents.onDidChangeContent(e => pendingDocuments$.next(e.document));
documents.listen(connection);

connection.onDocumentSymbol((e): Promise<SymbolInformation[]> => getSymbols(e.textDocument.uri));
connection.onHover((e): Promise<Hover> => getHover(e.textDocument.uri, e.position));
connection.onDefinition((e): Promise<Definition> => getDefinition(e.textDocument.uri, e.position));
connection.onReferences((e): Promise<Location[]> => getReferences(e.textDocument.uri, e.position));
connection.onCompletion((e): Promise<CompletionItem[]> => getCompletionItems(e.textDocument.uri, e.position));
connection.listen();