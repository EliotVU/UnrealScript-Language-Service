import { DocumentUri, Range } from 'vscode-languageserver-textdocument';

export type InlineChangeCommand = {
    uri: DocumentUri;
    range: Range;
    newText: string;
};

export const CommandsList = [
    CommandIdentifier.CreateClass,
    CommandIdentifier.Inline
];

export const enum CommandIdentifier {
    CreateClass = 'create.class',
    Inline = 'inline'
}