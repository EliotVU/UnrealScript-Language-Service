import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	const serverModule = context.asAbsolutePath(
		path.join('out', 'server.js')
	);

	const memoryOption = '--max-old-space-size=8192';
	const debugOptions = {
		execArgv: [memoryOption, '--nolazy', '--inspect=6010']
	};
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: {
				execArgv: [memoryOption]
			}
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions,
		}
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'unrealscript' }],
		synchronize: {
            configurationSection: 'unrealscript',
			fileEvents: [
                workspace.createFileSystemWatcher('**/*.{uc,uci}'),
                // Let's not watch for upk changes, just u files because those are expected to change often.
                workspace.createFileSystemWatcher('**/*.{u}')
            ]
		},
        diagnosticCollectionName: 'UnrealScript',
		outputChannelName: 'UnrealScript',
	};

	client = new LanguageClient(
		'ucLanguageServer',
		'UnrealScript',
		serverOptions,
		clientOptions
	);
	client.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}