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
	WorkspaceFolder,
	WorkspaceEdit,
	TextEdit,
	ResponseError,
	ErrorCodes,
	Location,
	SymbolKind,
	CompletionTriggerKind
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { getCompletableSymbolItems, getSymbolReferences, getSymbolDefinition, getSymbols, getSymbolTooltip, getSymbolHighlights, getFullCompletionItem } from './UC/helpers';
import { filePathByClassIdMap$, getDocumentByUri, queuIndexDocument, getIndexedReferences, config, defaultSettings, lastIndexedDocuments$, getDocumentById, applyMacroSymbols } from './UC/indexer';
import { ServerSettings, EAnalyzeOption } from './settings';
import { UCClassSymbol, UCFieldSymbol, DEFAULT_RANGE, UCSymbol, UCObjectTypeSymbol, UCTypeFlags, UCPackage, ObjectsTable } from './UC/Symbols';
import { toName } from './UC/names';

/** Emits true when the workspace is prepared and ready for indexing. */
const isIndexReady$ = new Subject<boolean>();

/** Emits a document that is pending an update. */
const pendingTextDocuments$ = new Subject<{ textDocument: TextDocument, isDirty: boolean }>();

const textDocuments: TextDocuments = new TextDocuments();

let hasWorkspaceFolderCapability: boolean = false;
let currentSettings: ServerSettings = defaultSettings;

export let connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: textDocuments.syncKind,
			hoverProvider: true,
			completionProvider: {
				triggerCharacters: ['.', '(', '[', ',', '<', '`'],
				resolveProvider: true
			},
			definitionProvider: true,
			documentSymbolProvider: true,
			documentHighlightProvider: true,
			referencesProvider: true,
			renameProvider: {
				prepareProvider: true
			}
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
					const files = glob.sync(path.join(folderPath, "**/+(*.uc|*.uci)"));
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

	lastIndexedDocuments$
		.pipe(
			filter(() => currentSettings.unrealscript.analyzeDocuments !== EAnalyzeOption.None),
			delay(50),
		)
		.subscribe(documents => {
			if (currentSettings.unrealscript.analyzeDocuments === EAnalyzeOption.OnlyActive) {
				// Only analyze active documents.
				documents = documents.filter(document => textDocuments.get(URI.parse(document.filePath).toString()))
			}

			for (const document of documents) {
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
			debounce(() => interval(50))
		)
		.subscribe(({ textDocument, isDirty }) => {
			const document = getDocumentByUri(textDocument.uri);
			console.assert(document, 'Failed to fetch document at: ' + textDocument.uri);

			if (isDirty) {
				document.invalidate();
			}

			if (!document.hasBeenIndexed) {
				queuIndexDocument(document, textDocument.getText());
			}
		}, (error) => connection.console.error(error));

	filePathByClassIdMap$
		.pipe(
			filter(classesMap => classesMap.size > 0),
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
			// TODO: does not respect multiple globals.uci files
			const globalUci = getDocumentById('globals.uci');
			if (globalUci) {
				queuIndexDocument(globalUci);
			}

			if (currentSettings.unrealscript.indexAllDocuments) {
				const indexStartTime = Date.now();
				connection.window.showInformationMessage('Indexing UnrealScript classes!');

				const documents = classes.map(uri => getDocumentByUri(uri));
				documents.forEach(document => {
					if (document.hasBeenIndexed) {
						return;
					}

					queuIndexDocument(document);
				});

				const time = Date.now() - indexStartTime;
				connection.window.showInformationMessage('UnrealScript classes have been indexed in ' + new Date(time).getSeconds() + ' seconds!');
			} else {
				const openDocuments = textDocuments.all();
				openDocuments.forEach(doc => {
					const document = getDocumentByUri(doc.uri);
					if (document && !document.hasBeenIndexed) {
						queuIndexDocument(document);
					}
				});
			}
			isIndexReady$.next(true);
		})
	);
});

connection.onDidChangeConfiguration((change) => {
	currentSettings = <ServerSettings>(change.settings);

	Object.assign(config, currentSettings.unrealscript);
	applyMacroSymbols(config.macroSymbols);

	const intSymbols = Object.entries(config.intrinsicSymbols);
	for (let [key, value] of intSymbols) {
		let [packageName, symbolName] = key.split('.');
		let pkg = ObjectsTable.getSymbol<UCPackage>(toName(packageName), UCTypeFlags.Package);
		if (!pkg) {
			pkg = new UCPackage(toName(packageName));
			ObjectsTable.addSymbol(pkg);
		}

		if (value.type === 'class') {
			const symbol = new UCClassSymbol({ name: toName(symbolName), range: DEFAULT_RANGE });
			if (value.extends) {
				symbol.extendsType = new UCObjectTypeSymbol({ name: toName(value.extends), range: DEFAULT_RANGE }, undefined, UCTypeFlags.Class);
			}
			pkg.addSymbol(symbol);
		} else {
			console.error('Unsupported symbol type!', value.type, 'try \'class\'!');
		}
	}

	isIndexReady$.next(true);
});

textDocuments.onDidOpen(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: false }));
textDocuments.onDidChangeContent(e => pendingTextDocuments$.next({ textDocument: e.document, isDirty: true }));
textDocuments.listen(connection);

connection.onDocumentSymbol((e) => getSymbols(e.textDocument.uri));
connection.onHover((e) => getSymbolTooltip(e.textDocument.uri, e.position));

connection.onDefinition(async (e) => {
	const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
	if (symbol instanceof UCSymbol) {
		const uri = symbol.getUri();
		// This shouldn't happen, except for non UCSymbol objects.
		if (!uri) {
			return undefined;
		}
		return Location.create(uri, symbol.id.range);
	}
	return undefined;
});

connection.onReferences((e) => getSymbolReferences(e.textDocument.uri, e.position));
connection.onDocumentHighlight((e) => getSymbolHighlights(e.textDocument.uri, e.position));

connection.onCompletion(async (e) => {
	let context = '';
	let position = e.position;
	if (e.context && e.context.triggerKind <= CompletionTriggerKind.TriggerCharacter) {
		const doc = textDocuments.get(e.textDocument.uri);
		if (!doc) {
			return undefined;
		}

		// TODO: Perhaps we should re-use ANTLR's lexer,
		// -- or try using a naive backtracking lexer until the first '.' token is hit, where "(), [] etc" are considered white space.
		const text = doc.getText();
		let parenthesisLevel = 0;
		let bracketLevel = 0;
		let shouldSkipNextChars = false;
		for (let colOffset = doc.offsetAt(position); colOffset >= 0; --colOffset) {
			const char = text[colOffset];
			if (char === ' ' || char === '\t' || char === '\n' || char === ';') {
				shouldSkipNextChars = false;
				continue;
			}

			if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')) {
				shouldSkipNextChars = context !== '.';
			} else if (char === '(') {
				--parenthesisLevel;
				continue;
			} else if (char === ')') {
				++parenthesisLevel;
				continue;
			} else if (char === '[') {
				--bracketLevel;
				continue;
			} else if (char === ']') {
				++bracketLevel;
				continue;
			}

			if (parenthesisLevel > 0 || bracketLevel > 0) {
				continue;
			}

			if (char === '.') {
				context = '.';
				shouldSkipNextChars = false;
				continue;
			}

			if (shouldSkipNextChars) {
				continue;
			}

			position = doc.positionAt(colOffset);
			break;
		}
	}
	return getCompletableSymbolItems(e.textDocument.uri, position, context);
});
connection.onCompletionResolve(getFullCompletionItem);

connection.onPrepareRename(async (e) => {
	const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
	if (!symbol) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol instanceof UCFieldSymbol) {
		if (symbol instanceof UCClassSymbol) {
			throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a class!');
		}
	} else {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol.id.range === DEFAULT_RANGE) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename this element!');
	}

	if (symbol.getKind() === SymbolKind.Constructor) {
		throw new ResponseError(ErrorCodes.InvalidRequest, 'You cannot rename a constructor!');
	}

	// Disallow symbols with invalid identifiers, such as an operator.
	if (!VALID_ID_REGEXP.test(symbol.getId().toString())) {
		throw new ResponseError(ErrorCodes.InvalidParams, 'You cannot rename this element!');
	}

	return symbol.id.range;
});

const VALID_ID_REGEXP = RegExp(/^([a-zA-Z_][a-zA-Z_0-9]*)$/);
connection.onRenameRequest(async (e) => {
	if (!VALID_ID_REGEXP.test(e.newName)) {
		throw new ResponseError(ErrorCodes.InvalidParams, 'Invalid identifier!');
	}

	const symbol = await getSymbolDefinition(e.textDocument.uri, e.position);
	if (!symbol) {
		return undefined;
	}
	const references = getIndexedReferences(symbol.getHash());
	const locations = references && Array
		.from(references.values())
		.map(ref => ref.location);

	if (!locations) {
		return undefined;
	}

	const changes = {};
	locations.forEach(l => {
		const ranges = changes[l.uri] || (changes[l.uri] = []);
		ranges.push(TextEdit.replace(l.range, e.newName));
	});
	const result: WorkspaceEdit = { changes };
	return result;
});

connection.listen();