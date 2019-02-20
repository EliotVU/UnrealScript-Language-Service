import { interval, Subject, of, AsyncSubject } from 'rxjs';
import { debounce, map, delay, switchMapTo } from 'rxjs/operators';

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

import { initWorkspace, getCompletionItems, getReferences, getDefinition, getSymbols, getHover } from './UC/helpers';
import URI from 'vscode-uri';
import { UCDocumentListener, ClassesMap$, getDocumentListenerByUri } from './UC/DocumentListener';

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

const pendingTextDocuments$ = new Subject<TextDocument>();

ClassesMap$
	.pipe(switchMapTo(pendingTextDocuments$), debounce(() => interval(300)))
	.subscribe((textDocument) => {
		connection.console.log('Validating' + textDocument.uri);

		let document = getDocumentListenerByUri(textDocument.uri);
		try {
			document.invalidate();
			document.parse(textDocument.getText());
			document.link();
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
			return;
		}

		const diagnostics = document.analyze();
		connection.sendDiagnostics({
			uri: document.uri,
			diagnostics
		});
	});

const pendingDocuments$ = new AsyncSubject<UCDocumentListener>();
pendingDocuments$
	.pipe(delay(100))
	.subscribe(document => {
		connection.console.log('linking' + document.name);
		// document.link();
	});

ClassesMap$
	.pipe(
		map(classesMap => {
			return Array
				.from(classesMap.values())
				.map(filePath => {
					const uri = URI.file(filePath).toString();
					return of(uri);
				});
		})
	)
	.subscribe((classes => {
		classes.map(classesFilePath$ => {
			classesFilePath$
				.pipe(delay(100))
				.subscribe(uri => {
					let document = getDocumentListenerByUri(uri);
					if (!document) {
						console.error('no document found for uri', uri);
						return;
					}
					// connection.console.log('parsing' + document.name);
					// document.parse(document.readText());
					pendingDocuments$.next(document);
				});
		});
	}));

documents.onDidOpen(e => pendingTextDocuments$.next(e.document));
documents.onDidSave(e => pendingTextDocuments$.next(e.document));
documents.listen(connection);

connection.onDocumentSymbol((e): Promise<SymbolInformation[]> => getSymbols(e.textDocument.uri));
connection.onHover((e): Promise<Hover> => getHover(e.textDocument.uri, e.position));
connection.onDefinition((e): Promise<Definition> => getDefinition(e.textDocument.uri, e.position));
connection.onReferences((e): Promise<Location[]> => getReferences(e.textDocument.uri, e.position));
connection.onCompletion((e): Promise<CompletionItem[]> => getCompletionItems(e.textDocument.uri, e.position));
connection.listen();