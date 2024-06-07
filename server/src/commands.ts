import * as path from 'path';
import { Position, Range, WorkspaceChange } from 'vscode-languageserver';
import { DocumentUri } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export type ExecuteCommandFunction = (
    ...params: any[]
) => void | WorkspaceChange;

const CreateClassCommand: ExecuteCommandFunction = ({ uri, className }: {
    uri: DocumentUri,
    className: string
}) => {
    const filePath = URI.parse(uri).fsPath;
    const newFilePath = path.join(path.dirname(filePath), `${className}.uc`);
    const newDocumentUri = URI
        .file(newFilePath)
        .toString();

    const change = new WorkspaceChange();
    change.createFile(newDocumentUri, { ignoreIfExists: true })
    change
        .getTextEditChange({ uri: newDocumentUri, version: 1 })
        .add({
            range: Range.create(Position.create(0, 0), Position.create(0, 0)),
            newText: `class ${className} extends Object;`,
        });

    return change;
};

const InlineCommand: ExecuteCommandFunction = ({ uri, range, newText }: {
    uri: DocumentUri,
    range: Range,
    newText: string
}) => {
    const change = new WorkspaceChange();
    change
        .getTextEditChange({ uri, version: null })
        .replace(range, newText);

    return change;
};

export const enum CommandIdentifier {
    CreateClass = 'create.class',
    Inline = 'inline',
}

const CommandsMap: { [CommandIdentifier: string]: ExecuteCommandFunction } = {
    [CommandIdentifier.CreateClass]: CreateClassCommand,
    [CommandIdentifier.Inline]: InlineCommand,
};

/** Dynamically register (or override) a command to the map, this must be called before the server begins initializing. */
export function registerCommand(identifier: string, command: ExecuteCommandFunction) {
    CommandsMap[identifier] = command;
}

export function getCommand(identifier: string): ExecuteCommandFunction {
    return CommandsMap[identifier];
}

export function getCommands(): string[] {
    return Object.getOwnPropertyNames(CommandsMap);
}

export function executeCommand(
    command: ExecuteCommandFunction,
    params: any[] = []
): void | WorkspaceChange {
    return command(...params);
}
