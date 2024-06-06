import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver';
import * as snippets from './snippets.json';

// export const InterfaceDeclarationSnippet: CompletionItem = {
//     label: 'interface',
//     kind: CompletionItemKind.Snippet,
//     detail: 'Interface Declaration',
//     insertText: snippets['Interface Declaration'].body.join('\r\n'),
//     insertTextFormat: InsertTextFormat.Snippet,
//     insertTextMode: InsertTextMode.adjustIndentation
// };

// export const ClassDeclarationSnippet: CompletionItem = {
//     label: 'class',
//     kind: CompletionItemKind.Snippet,
//     detail: 'Class Declaration',
//     insertText: snippets['Class Declaration'].body.join('\r\n'),
//     insertTextFormat: InsertTextFormat.Snippet,
//     insertTextMode: InsertTextMode.adjustIndentation
// };

export const ConstDeclarationSnippet: CompletionItem = {
    label: 'const',
    kind: CompletionItemKind.Snippet,
    detail: 'Const Declaration',
    insertText: snippets['Const Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const EnumDeclarationSnippet: CompletionItem = {
    label: 'enum',
    kind: CompletionItemKind.Snippet,
    detail: 'Enum Declaration',
    insertText: snippets['Enum Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const StructDeclarationSnippet: CompletionItem = {
    label: 'struct',
    kind: CompletionItemKind.Snippet,
    detail: 'Struct Declaration',
    insertText: snippets['Struct Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const VarDeclarationSnippet: CompletionItem = {
    label: 'var',
    kind: CompletionItemKind.Snippet,
    detail: 'Var Declaration',
    insertText: snippets['Var Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const FunctionDeclarationSnippet: CompletionItem = {
    label: 'function',
    kind: CompletionItemKind.Snippet,
    detail: 'Function Declaration',
    insertText: snippets['Function Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const LocalDeclarationSnippet: CompletionItem = {
    label: 'local',
    kind: CompletionItemKind.Snippet,
    detail: 'Local Declaration',
    insertText: snippets['Local Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const StateDeclarationSnippet: CompletionItem = {
    label: 'state',
    kind: CompletionItemKind.Snippet,
    detail: 'State Declaration',
    insertText: snippets['State Declaration'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const ReplicationBlockSnippet: CompletionItem = {
    label: 'replication',
    kind: CompletionItemKind.Snippet,
    detail: 'Replication Block',
    insertText: snippets['Replication Block'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const DefaultPropertiesBlockSnippet: CompletionItem = {
    label: 'defaultproperties',
    kind: CompletionItemKind.Snippet,
    detail: 'DefaultProperties Block',
    insertText: snippets['DefaultProperties Block'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const StructDefaultPropertiesBlockSnippet: CompletionItem = {
    label: 'structdefaultproperties',
    kind: CompletionItemKind.Snippet,
    detail: 'StructDefaultProperties Block',
    insertText: snippets['StructDefaultProperties Block'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};

export const ArchetypeBlockSnippet: CompletionItem = {
    label: 'begin object',
    kind: CompletionItemKind.Snippet,
    detail: 'Archetype Block',
    insertText: snippets['Archetype Block'].body.join('\r\n'),
    insertTextFormat: InsertTextFormat.Snippet,
    insertTextMode: InsertTextMode.adjustIndentation
};
