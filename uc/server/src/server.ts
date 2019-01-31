import * as path from 'path';
import * as fs from 'fs';

import { interval, Subject, BehaviorSubject } from 'rxjs';
import { debounce } from 'rxjs/operators';

import URI from 'vscode-uri';
import {
	createConnection,
	TextDocuments,
	TextDocument,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	RemoteWorkspace,
	Hover,
	Location,
	Diagnostic,
	Definition,
	DocumentSymbolParams,
	SymbolInformation,
	ReferenceParams,
	DiagnosticSeverity,
	TextDocumentPositionParams,
	Range
} from 'vscode-languageserver';

import { FUNCTION_MODIFIERS, CLASS_DECLARATIONS, PRIMITIVE_TYPE_NAMES, VARIABLE_MODIFIERS, FUNCTION_DECLARATIONS, STRUCT_DECLARATIONS, STRUCT_MODIFIERS } from "./UC/keywords";
import { UCSymbol, UCSymbolRef, UCPackage, UCStructSymbol, UCScriptStructSymbol, UCPropertySymbol, UCFunctionSymbol, UCClassSymbol, CORE_PACKAGE } from './UC/symbols';
import { UCDocumentListener } from "./UC/DocumentListener";

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments = new TextDocuments();
let documentListeners: Map<string, UCDocumentListener> = new Map<string, UCDocumentListener>();

let projectClassTypes: CompletionItem[] = [];

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

let WorkspaceClassesMap$ = new BehaviorSubject(new Map<string, string>());

WorkspaceClassesMap$.subscribe(classesMap => {
	projectClassTypes = Array.from(classesMap.values())
		.map(value => {
			return {
				label: path.basename(value, '.uc'),
				kind: CompletionItemKind.Class
			};
		});
});

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

async function scanWorkspaceForClasses(workspace: RemoteWorkspace): Promise<Map<string, string>> {
	function scanPath(filePath: string, cb: (filePath: string) => void): Promise<boolean> {
		let promise = new Promise<boolean>((resolve) => {
			if (!fs.existsSync(filePath)) {
				resolve(false);
				return;
			}

			fs.lstat(filePath, (err, stats) => {
				if (stats.isDirectory()) {
					fs.readdir(filePath, (err, filePaths) => {
						for (let fileName of filePaths) {
							resolve(scanPath(path.join(filePath, fileName), cb));
						}
					});
				} else {
					if (path.extname(filePath) === '.uc') {
						cb(filePath);
					}
					resolve(true);
				}
			});
		});
		return promise;
	}

	let filePaths = new Map<string, string>();
	let folders = await workspace.getWorkspaceFolders();
	for (let folder of folders) {
		let folderPath = URI.parse(folder.uri).fsPath;
		await scanPath(folderPath, (filePath => {
			filePaths.set(path.basename(filePath, '.uc').toLowerCase(), filePath);
		}));
	}
	return filePaths;
}

async function initWorkspace() {
	const UCFilePaths = await scanWorkspaceForClasses(connection.workspace);
	WorkspaceClassesMap$.next(UCFilePaths);
}

const WorkspaceSymbolsTable = new UCPackage('Workspace');
WorkspaceSymbolsTable.addSymbol(CORE_PACKAGE);

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		initWorkspace();
		connection.workspace.onDidChangeWorkspaceFolders(e => initWorkspace());
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

const documents$ = new Subject<TextDocument>();
documents$
	.pipe(debounce(() => interval(300)))
	.subscribe(document => {
		connection.console.log('Content did change for document ' + document.uri);
		validateTextDocument(document);
	});

documents.onDidChangeContent(e => documents$.next(e.document));

function findQualifiedIdUri(qualifiedClassId: string): string | undefined {
	const filePath: string = WorkspaceClassesMap$.value.get(qualifiedClassId);
	if (!filePath) {
		return undefined;
	}

	// FIXME: may not exist
	if (!fs.existsSync(filePath)) {
		return undefined;
	}

	const uriFromFilePath = URI.file(filePath).toString();
	return uriFromFilePath;
}

function findDocumentListener(qualifiedClassId: string, callback: (document: UCDocumentListener) => void) {
	connection.console.log('Looking for external document ' + qualifiedClassId);

	// Try the shorter route first before we scan the entire workspace!
	if (WorkspaceSymbolsTable) {
		let classSymbol = WorkspaceSymbolsTable.findQualifiedSymbol(qualifiedClassId, true);
		if (classSymbol && classSymbol instanceof UCClassSymbol) {
			callback(classSymbol.document);
			return;
		}
	}

	const uri = findQualifiedIdUri(qualifiedClassId);
	if (!uri) {
		callback(undefined);
		return;
	}

	const document: UCDocumentListener = createDocumentListener(uri);
	// TODO: Parse and link created document.
	callback(document);
}

function createDocumentListener(uri: string): UCDocumentListener {
	let document: UCDocumentListener = documentListeners.get(uri);
	if (document) {
		return document;
	}

	document = new UCDocumentListener(WorkspaceSymbolsTable, uri);
	document.getDocument = findDocumentListener;
	documentListeners.set(uri, document);
	return document;
}

function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let document = createDocumentListener(textDocument.uri);

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
	diagnoseDocument(document);
}

function diagnoseDocument(document: UCDocumentListener) {
	const diagnostics = document.analyze();

	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics
	});
}

function getDocumentSymbolAtPosition(e: TextDocumentPositionParams): UCSymbol {
	let document = documentListeners.get(e.textDocument.uri);
	if (!document || !document.class) {
		return undefined;
	}
	return document.class.getSymbolAtPos(e.position);
}

connection.onHover((e): Hover => {
	const symbol = getDocumentSymbolAtPosition(e);
	if (!symbol) {
		return undefined;
	}

	connection.console.log('Hovering: ' + symbol.getTooltip() + ' at ' + JSON.stringify(symbol.getIdRange()) + ' ' + symbol.getName());

	return {
		contents: symbol.getTooltip(),
		range: symbol.getIdRange()
	};
});

connection.onDocumentSymbol((e: DocumentSymbolParams): SymbolInformation[] => {
	let document = documentListeners.get(e.textDocument.uri);
	if (!document || !document.class) {
		return undefined;
	}

	var contextSymbols = [];
	var buildSymbolsList = (container: UCStructSymbol) => {
		for (let child = container.children; child; child = child.next) {
			contextSymbols.push(child.toSymbolInfo());
			if (child instanceof UCStructSymbol) {
				buildSymbolsList(child as UCStructSymbol);
			}
		}
	};

	buildSymbolsList(document.class);
	return contextSymbols;
});

// Bare implementation to support "go-to-defintion" for variable declarations type references.
connection.onDefinition((e): Definition => {
	const symbol = getDocumentSymbolAtPosition(e);
	if (!symbol) {
		return undefined;
	}

	if (symbol instanceof UCSymbolRef) {
		let reference = symbol.getReference();
		if (reference instanceof UCSymbol) {
			return Location.create(reference.getUri(), reference.getIdRange());
		}
	}
});

connection.onReferences((e: ReferenceParams): Location[] => {
	const symbol = getDocumentSymbolAtPosition(e);
	if (!symbol) {
		return undefined;
	}
	return symbol.getReferencedLocations();
});

connection.onCompletion((e): CompletionItem[] => {
	let document = documentListeners.get(e.textDocument.uri);
	if (!document || !document.class) {
		return undefined;
	}

	const symbol = document.class.getSymbolAtPos(e.position);
	if (!symbol) {
		return undefined;
	}

	const items: CompletionItem[] = [];
	if (symbol instanceof UCStructSymbol) {
		for (let child = symbol.children; child; child.next) {
			items.push(child.toCompletionItem());
		}
	}

	if (symbol instanceof UCClassSymbol) {
		return []
			.concat(CLASS_DECLARATIONS, FUNCTION_MODIFIERS)
			.map(type => {
				return {
					label: type,
					kind: CompletionItemKind.Keyword
				} as CompletionItem;
			});
	} else if (symbol instanceof UCPropertySymbol) {
		return []
			.concat(VARIABLE_MODIFIERS, PRIMITIVE_TYPE_NAMES)
			.map(type => {
				return {
					label: type,
					kind: CompletionItemKind.Keyword
				} as CompletionItem;
			})
			.concat(projectClassTypes, items);
	}
	else if (symbol instanceof UCFunctionSymbol) {
		return []
			.concat(FUNCTION_DECLARATIONS, FUNCTION_MODIFIERS, PRIMITIVE_TYPE_NAMES)
			.map(type => {
				return {
					label: type,
					kind: CompletionItemKind.Keyword
				} as CompletionItem;
			})
			.concat(projectClassTypes, items);
	}
	else if (symbol instanceof UCScriptStructSymbol) {
		return []
			.concat(STRUCT_DECLARATIONS, STRUCT_MODIFIERS)
			.map(type => {
				return {
					label: type,
					kind: CompletionItemKind.Keyword
				} as CompletionItem;
			});
	}

	const documentItems = [];
	for (let container: UCStructSymbol = document.class; container; container = container.super) {
		for (let child = container.children; child; child = child.next) {
			documentItems.push(child.toCompletionItem());
		}
	}

	return []
		.concat(STRUCT_DECLARATIONS)
		.map(type => {
			return {
				label: type,
				kind: CompletionItemKind.Keyword
			} as CompletionItem;
		})
		.concat(items, documentItems);
});

documents.listen(connection);
connection.listen();