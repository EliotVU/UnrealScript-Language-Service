import * as path from 'path';
import { CodeAction, CodeActionKind, Command } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { CommandIdentifier, InlineChangeCommand } from './commands';
import { UCDocument } from './document';
import { UCConstSymbol, UCObjectTypeSymbol, UCSymbolKind } from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

export class DocumentCodeActionsBuilder extends DefaultSymbolWalker<undefined> {
    public readonly codeActions: CodeAction[] = [];

    constructor(private document: UCDocument) {
        super();
    }

    private addCodeAction(codeAction: CodeAction): void {
        this.codeActions.push(codeAction);
    }

    override visitObjectType(symbol: UCObjectTypeSymbol) {
        const referredSymbol = symbol.getRef();
        if (!referredSymbol) {
            if (symbol.getExpectedKind() === UCSymbolKind.Class) {
                const documentUri = this.document.filePath;
                const newClassName = symbol.getName().text;
                const newFileName = newClassName + '.uc';

                const uri = URI
                    .file(path.join(
                        documentUri.substring(0, documentUri.lastIndexOf(path.sep)),
                        newFileName))
                    .toString();

                this.addCodeAction({
                    title: 'Generate class',
                    kind: CodeActionKind.RefactorExtract,
                    command: Command.create(
                        'Generate class',
                        CommandIdentifier.CreateClass,
                        uri,
                        newClassName,
                    ),
                });
            } else {
                // TODO:
            }
        } else {
            if (referredSymbol.kind === UCSymbolKind.Const) {
                const evaluatedValue = (referredSymbol as UCConstSymbol).getComputedValue();
                if (typeof evaluatedValue === 'undefined') {
                    return;
                }

                const documentUri = URI.file(this.document.filePath).toString();
                this.addCodeAction({
                    title: 'Inline constant',
                    kind: CodeActionKind.RefactorInline,
                    command: Command.create(
                        'Inline constant',
                        CommandIdentifier.Inline, {
                            uri: documentUri,
                            range: symbol.getRange(),
                            newText: evaluatedValue.toString()
                        } as InlineChangeCommand
                    ),
                });
            }
        }
        super.visitObjectType(symbol);
    }
}