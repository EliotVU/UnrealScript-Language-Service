import { TextDocument } from 'vscode-languageserver-textdocument';
import { TextDocuments } from 'vscode-languageserver/node';

export const ActiveTextDocuments = new TextDocuments(TextDocument);