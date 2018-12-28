import * as path from 'path';
import * as fs from 'fs';

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
	SymbolKind,
	WorkspaceSymbolParams} from 'vscode-languageserver';

import {
	DocumentParser, UCDocument, UCDocSymbol, UCProperty, UCStruct, rangeFromToken, UCClass,
	FUNCTION_MODIFIERS, CLASS_DECLARATIONS, PRIMITIVE_TYPE_NAMES, VARIABLE_MODIFIERS,
	UCFunction, FUNCTION_DECLARATIONS, STRUCT_DECLARATIONS,
	STRUCT_MODIFIERS, UCScriptStruct, UCPackage, UCSymbolRef, NATIVE_SYMBOLS
} from './parser';

let connection = createConnection(ProposedFeatures.all);

let workspaceUCFiles: string[] = [];

let documents: TextDocuments = new TextDocuments();
let projectDocuments: Map<string, UCDocument> = new Map<string, UCDocument>();

let documentItems: CompletionItem[] = [];
let projectClassTypes: CompletionItem[] = [];

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

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

async function scanWorkspaceForClasses(workspace: RemoteWorkspace) {
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

	let filePaths = [];
	let folders = await workspace.getWorkspaceFolders();
	for (let folder of folders) {
		let folderPath = URI.parse(folder.uri).fsPath;
		await scanPath(folderPath, (filePath => {
			filePaths.push(filePath);
		}));
	}
	return filePaths;
}

function initializeClassTypes(classFilePaths: string[]) {
	projectClassTypes = classFilePaths
		.map((document => {
			return {
				label: path.basename(document, '.uc'),
				kind: CompletionItemKind.Class,
				data: document
			}
		}));
}

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		connection.client.register(
			DidChangeConfigurationNotification.type,
			undefined
		);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(async _event => {
			workspaceUCFiles = await scanWorkspaceForClasses(connection.workspace);
			initializeClassTypes(workspaceUCFiles);
		});
	}
});

interface UCSettings {

}

let documentSettings: Map<string, Thenable<UCSettings>> = new Map();

connection.onDidChangeConfiguration(() => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
	}
	documents.all().forEach(validateTextDocument);
});


documents.onDidOpen(async e => {
	if (workspaceUCFiles.length === 0) {
		workspaceUCFiles = await scanWorkspaceForClasses(connection.workspace);
		initializeClassTypes(workspaceUCFiles);
	}
	validateTextDocument(e.document);
});

documents.onDidChangeContent(async e => {
	if (workspaceUCFiles.length === 0) {
		workspaceUCFiles = await scanWorkspaceForClasses(connection.workspace);
		initializeClassTypes(workspaceUCFiles);
	}
	invalidateDocument(e.document);
	validateTextDocument(e.document);
});

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

function invalidateDocument(textDocument: TextDocument) {
	connection.sendDiagnostics({
		uri: textDocument.uri,
		diagnostics: []
	});
	projectDocuments.delete(textDocument.uri);
}

var WorkspacePackage = new UCPackage('Workspace');
NATIVE_SYMBOLS.forEach(symbol => WorkspacePackage.addSymbol(symbol));

function parseTextDocument(textDocument: TextDocument): UCDocument {

	// TODO: Hash check
	let document = projectDocuments.get(textDocument.uri);
	if (!document) {
		try {
			const parser = new DocumentParser(textDocument.uri, textDocument.getText(), WorkspacePackage);
			document = parser.parse((className): UCDocument => {
				console.log('Looking for external document', className);

				let filePaths = workspaceUCFiles;
				let filePath = filePaths.find((value => {
					return path.basename(value, '.uc') === className;
				}));

				if (!filePath) {
					return null;
				}

				const externalDocument = projectDocuments.get(filePath);
				if (externalDocument) {
					return externalDocument;
				}
				// FIXME: may not exist
				let documentContent = fs.readFileSync(filePath).toString();
				let externalTextDocument = TextDocument.create(filePath, 'unrealscript', 0.0, documentContent);
				return parseTextDocument(externalTextDocument);
			});
			parser.link();
			diagnoseDocument(document);
			projectDocuments.set(document.uri, document);
		} catch (err) {
			console.error('couldn\' parse document!', err);
		}
	}
	return document;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	let document = parseTextDocument(textDocument);
	if (!document) {
		return;
	}
	diagnoseDocument(document);

	if (document.class === null) {
		return;
	}

	documentItems = []; // reset, never show any items from previous documents.
	for (let fieldStruct: UCStruct = document.class; fieldStruct; fieldStruct = fieldStruct.extends) {
		if (!fieldStruct.symbols) {
			continue;
		}

		for (const symbol of fieldStruct.symbols.values()) {
			documentItems.push(symbol.toCompletionItem());
		}
	}
}

function diagnoseDocument(document: UCDocument) {
	const diagnostics: Diagnostic[] = [];
	if (document.nodes && document.nodes.length > 0) {
		let errors: Diagnostic[] = document.nodes
			.map(node => {
				return Diagnostic.create(
					rangeFromToken(node.getToken()),
					node.toString()
				);
			});

		diagnostics.push(...errors);
	}

	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics: diagnostics
	});
}

connection.onHover((e): Hover => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return undefined;
	}

	const hoverOffset = documents.get(document.uri).offsetAt(e.position);
	const tokenItem = document.getSymbolAtOffset(hoverOffset);
	if (!tokenItem) {
		return undefined;
	}

	return {
		contents: tokenItem.getTooltip(),
		range: tokenItem.getRange()
	};
});

// Bare implementation to support "go-to-defintion" for variable declarations type references.
connection.onDefinition((e): Definition => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return null;
	}

	const hoverOffset = documents.get(document.uri).offsetAt(e.position);
	const symbol = document.getSymbolAtOffset(hoverOffset);
	if (!symbol) {
		return null;
	}

	if (symbol instanceof UCSymbolRef) {
		let reference = symbol.getReference() as UCDocSymbol;
		if (reference instanceof UCDocSymbol) {
			return Location.create(reference.getUri() , reference.getRange());
		}
	}
});

connection.onDocumentSymbol((e: DocumentSymbolParams): SymbolInformation[] => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document || !document.class) {
		return null;
	}

	var contextSymbols = [];
	var buildSymbolsList = (container: UCStruct) => {
		for (let symbol of container.symbols.values()) {
			contextSymbols.push(symbol.toSymbolInfo());
			if (symbol instanceof UCStruct) {
				buildSymbolsList(symbol as UCStruct);
			}
		}
	};

	buildSymbolsList(document.class);
	return contextSymbols;
});

connection.onWorkspaceSymbol((e: WorkspaceSymbolParams) => {
	console.error('ws, symbol', e.query);
	return undefined;
});

connection.onReferences((e: ReferenceParams): Location[] => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return null;
	}

	const offset = documents.get(document.uri).offsetAt(e.position);
	let contextSymbol = document.getSymbolAtOffset(offset);
	if (!contextSymbol) {
		return undefined;
	}

	return contextSymbol.getLinks();
});

connection.onCompletion((e): CompletionItem[] => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return null;
	}

	const items = [];

	const offset = documents.get(document.uri).offsetAt(e.position);
	let contextSymbol = document.getSymbolAtOffset(offset);
	if (!contextSymbol) {
		contextSymbol = document.class;
	}

	if (contextSymbol instanceof UCClass) {
		return []
			.concat(CLASS_DECLARATIONS, FUNCTION_MODIFIERS)
			.map(kw => {
				return {
					label: kw,
					kind: CompletionItemKind.Keyword
				} as CompletionItem;
			});
	} else if(contextSymbol instanceof UCProperty) {
		document.class.symbols.forEach((symbol) => {
			if (symbol.getKind() !== SymbolKind.Struct && symbol.getKind() !== SymbolKind.Enum) {
				return;
			}
			items.push({
				label: symbol.getName(),
				detail: symbol.getTooltip(),
				documentation: symbol.getDocumentation(),
			});
		});

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
	else if (contextSymbol instanceof UCFunction) {
		document.class.symbols.forEach((symbol) => {
			if (symbol.getKind() === SymbolKind.Struct) {
				return;
			}
			items.push({
				label: symbol.getName(),
				detail: symbol.getTooltip(),
				documentation: symbol.getDocumentation(),
			});
		});

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
	else if (contextSymbol instanceof UCScriptStruct) {
		return []
			.concat(STRUCT_DECLARATIONS, STRUCT_MODIFIERS)
			.map(type => {
					return {
						label: type,
						kind: CompletionItemKind.Keyword
					} as CompletionItem;
			});
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