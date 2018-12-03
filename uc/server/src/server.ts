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
	Location
} from 'vscode-languageserver';

import { uriToFilePath } from 'vscode-languageserver/lib/files';

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
			documentHighlightProvider: true,
			hoverProvider: true,
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
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// TODO:
	return;
}

// connection.onDocumentHighlight((docParams: TextDocumentPositionParams): DocumentHighlight[] => {
// 	return [{
// 		range: { start: { line: 1, character: 0 }, end: { line: 100, character: 100 } },
// 		kind: DocumentHighlightKind.Read
// 	}];
// });

// connection.onHover((_txtDocumentPosition) => {
// 	return null as Hover;
// });

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
	async (_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
		var classTypes = projectClassTypes;
		return classTypes;
	}
);

connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.kind == CompletionItemKind.Class) {
			item.documentation = 'UnrealScript Class\n' + item.data;
		}
		return item;
	}
);

documents.listen(connection);
connection.listen();