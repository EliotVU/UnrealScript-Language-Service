import * as path from 'path';
import * as fs from 'fs';

import {
	createConnection,
	TextDocuments,
	TextDocument,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	RemoteWorkspace,
	Hover,
	DocumentHighlight,
	DocumentHighlightKind,
	DefinitionRequest,
	Location,
	Diagnostic,
	DiagnosticSeverity,
	Range
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

import { ScopeParser, UCDocument, UCFunction, UCProperty, UCStruct } from './parser';
import { Token } from 'antlr4ts/Token';

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments = new TextDocuments();
let workspaceUCFiles: string[] = [];
let projectClassTypes: CompletionItem[] = [];

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability =
		!!(capabilities.textDocument &&
			capabilities.textDocument.publishDiagnostics &&
			capabilities.textDocument.publishDiagnostics.relatedInformation);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			// documentHighlightProvider: true,
			// hoverProvider: true,
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			definitionProvider: true
		}
	};
});

async function scanWorkspaceForClasses(workspace: RemoteWorkspace) {
	function scanPath(filePath: string, cb: (filePath: string) => void): Promise<boolean> {
		let promise = new Promise<boolean>((resolve, reject) => {
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
		let folderPath = uriToFilePath(folder.uri);
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
		workspaceUCFiles = await scanWorkspaceForClasses(connection.workspace);
		initializeClassTypes(workspaceUCFiles);

		connection.workspace.onDidChangeWorkspaceFolders(async _event => {
			workspaceUCFiles = await scanWorkspaceForClasses(connection.workspace);
			initializeClassTypes(workspaceUCFiles);
		});
	}
});

interface UCSettings {

}

const defaultSettings: UCSettings = {};
let globalSettings: UCSettings = defaultSettings;
let documentSettings: Map<string, Thenable<UCSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = <UCSettings>(
			(change.settings.ucLanguageServer || defaultSettings)
		);
	}
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<UCSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'ucLanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
	if (workspaceUCFiles.length === 0) {
		return;
	}
	validateTextDocument(change.document);
});

let projectDocuments: Map<string, UCDocument> = new Map<string, UCDocument>();
let documentItems: CompletionItem[] = [];

function rangeFromToken(token: Token): Range {
	return {
		start: {
			line: token.line-1,
			character: token.charPositionInLine
		},
		end: {
			line: token.line-1,
			character: token.charPositionInLine + token.text.length
		}
	};
}

function parseTextDocument(textDocument: TextDocument): UCDocument {
	// TODO: Hash check
	let document;// = projectDocuments.get(textDocument.uri);
	if (!document) {
		const scopeParser = new ScopeParser(textDocument.uri, textDocument.getText());
		document = scopeParser.parse((className) => {
			console.log('Looking for external document', className);

			let filePaths = workspaceUCFiles;
			let filePath = filePaths.find((value => {
				return path.basename(value, '.uc') === className;
			}));

			if (!filePath) {
				return null;
			}

			// FIXME: may not exist
			let documentContent = fs.readFileSync(filePath).toString();
			let externalTextDocument = TextDocument.create(filePath, 'unrealscript', 0.0, documentContent);
			return parseTextDocument(externalTextDocument);
		});
		projectDocuments.set(document.uri, document);
	}
	return document;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	documentItems = []; // reset, never show any items from previous documents.

	let document = parseTextDocument(textDocument);
	if (document.class === null || document.class.nameToken === null) {
		// TODO: Generate diagnostic
		return;
	}

	const className = document.class.nameToken.text;

	documentItems.push({
		label: className,
		kind: CompletionItemKind.Class,
		data: 'UnrealScript Class'
	});

	for (let fieldStruct: UCStruct = document.class; fieldStruct; fieldStruct = fieldStruct.extends) {
		if (!fieldStruct.fields) {
			continue;
		}

		for (const field of fieldStruct.fields) {
			let item = null;
			try {
				if (field instanceof UCFunction) {
					item = {
						label: field.nameToken.text,
						kind: CompletionItemKind.Method,
						data: (field as UCFunction).returnTypeToken ? (field as UCFunction).returnTypeToken.text : 'none'
					};
				} else if (field instanceof UCProperty) {
					item = {
						label: field.nameToken.text,
						kind: CompletionItemKind.Property,
						data: (field as UCProperty).typeToken ? (field as UCProperty).typeToken.text : 'none'
					};
				} else {
					item = {
						label: field.nameToken.text,
						kind: CompletionItemKind.Field,
						data: undefined
					};
				}
			} catch (err) {
				console.error(err);
			}

			if (item) {
				documentItems.push(item);
			}
		}
	}

	const workingClassName = path.basename(textDocument.uri, '.uc');
	if (workingClassName != className) {
		let diagnostic = Diagnostic.create(
			rangeFromToken(document.class.nameToken),
			`Class ${className} name must be equal to file name ${workingClassName}!`,
			DiagnosticSeverity.Error
		);

		connection.sendDiagnostics({
			uri: textDocument.uri,
			diagnostics: [diagnostic]
		});
	}
	return;
}

connection.onDocumentHighlight((docParams: TextDocumentPositionParams): DocumentHighlight[] => {
	return [];
});

connection.onHover((_txtDocumentPosition) => {
	return null as Hover;
});

connection.onDefinition((_textDocumentPosition, token): Location => {
	return {
		uri: '',
		range: {
			start: {
				line: 1,
				character: 1
			},
			end: {
				line: 1,
				character: 1
			}
		}
	};
});

connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		var classTypes = projectClassTypes;
		return documentItems.concat(classTypes);
	}
);

connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		item.documentation = item.data;
		return item;
	}
);

documents.listen(connection);
connection.listen();