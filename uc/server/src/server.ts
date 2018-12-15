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
	SymbolInformation} from 'vscode-languageserver';

import { DocumentAnalyzer, UCDocument, UCFunction, UCProperty, UCStruct, UCConst, UCEnum, rangeFromToken } from './parser';

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
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			definitionProvider: true,
			documentSymbolProvider: true
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

const defaultSettings: UCSettings = {};
let documentSettings: Map<string, Thenable<UCSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
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

function parseTextDocument(textDocument: TextDocument): UCDocument {
	// TODO: Hash check
	let document = projectDocuments.get(textDocument.uri);
	if (!document) {
		try {
			const scopeParser = new DocumentAnalyzer(textDocument.uri, textDocument.getText());
			document = scopeParser.parse((className): UCDocument => {
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
			scopeParser.link();
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
	diagnoseDocument(document);

	if (document.class === null) {
		return;
	}

	documentItems = []; // reset, never show any items from previous documents.
	for (let fieldStruct: UCStruct = document.class; fieldStruct; fieldStruct = fieldStruct.extends) {
		if (!fieldStruct.fields) {
			continue;
		}

		for (const field of fieldStruct.fields) {
			try {
				let item: CompletionItem = {
					label: field.getName(),
					detail: field.getTooltip(),
					documentation: field.getDocumentation()
				};

				if (field instanceof UCFunction) {
					item.kind = CompletionItemKind.Method;
				} else if (field instanceof UCProperty) {
					item.kind = CompletionItemKind.Property;
				} else if (field instanceof UCConst) {
					item.kind = CompletionItemKind.Constant;
				} else if (field instanceof UCStruct) {
					item.kind = CompletionItemKind.Struct;
				} else if (field instanceof UCEnum) {
					item.kind = CompletionItemKind.Enum;
				} else {
					item.kind = CompletionItemKind.Field;
				}

				documentItems.push(item);
			} catch (err) {
				console.error(err);
			}
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
	const tokenItem = document.getItemAtOffset(hoverOffset);
	if (!tokenItem) {
		return undefined;
	}

	const token = tokenItem.findTokenAtPosition(e.position);

	return {
		contents: tokenItem.getTooltip(token),
		range: token ? rangeFromToken(token) : undefined
	};
});

// Bare implementation to support "go-to-defintion" for variable declarations type references.
connection.onDefinition((e): Definition => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return null;
	}

	const hoverOffset = documents.get(document.uri).offsetAt(e.position);
	const tokenItem = document.getItemAtOffset(hoverOffset);
	if (!tokenItem) {
		return null;
	}

	if (tokenItem instanceof UCProperty) {
		// assumed
		const typeToken = tokenItem.findTokenAtPosition(e.position);
		console.log('type token', typeToken);
		if (typeToken) {
			const typeName = typeToken.text.toLowerCase();

			const classFilePaths = workspaceUCFiles.filter(filePath => path.basename(filePath, '.uc').toLowerCase() === typeName);
			const emptyRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

			const locations = classFilePaths.map(filePath => Location.create(URI.file(filePath).toString(), emptyRange));
			return locations;
		}
	}
	// const getOuterMost = (outer: UCField) => {
	// 	for (var field = outer; field; field = field.outer);
	// 	return field;
	// };
});

connection.onDocumentSymbol((e: DocumentSymbolParams): SymbolInformation[] => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document || !document.class) {
		return null;
	}

	return document.class.fields.map(field => {
		return SymbolInformation.create(field.getName(), field.getKind(), field.getRange(), field.outer ? field.outer.getName() : undefined);
	});
});

connection.onCompletion((e): CompletionItem[] => {
	let document = projectDocuments.get(e.textDocument.uri);
	if (!document) {
		return null;
	}

	const items = projectClassTypes;

	const hoverOffset = documents.get(document.uri).offsetAt(e.position);
	const tokenItem = document.getItemAtOffset(hoverOffset);
	if (!tokenItem) {
		return items;
	}

	return items.concat(documentItems, tokenItem instanceof UCStruct ? (tokenItem as UCStruct).fields.map(field => {
		return {
			label: field.getName(),
			detail: field.getTooltip(),
			documentation: field.getDocumentation(),
		} as CompletionItem;
	}) : []);
});

// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
// 	return item;
// });

documents.listen(connection);
connection.listen();