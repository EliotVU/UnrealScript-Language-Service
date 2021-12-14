import * as path from 'path';
import { CodeAction, CodeActionKind, Command } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

import { UCDocument } from './document';
import { UCObjectTypeSymbol, UCTypeFlags } from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

export class DocumentCodeActionsBuilder extends DefaultSymbolWalker<undefined> {
    public readonly codeActions: CodeAction[] = [];

	constructor(private document: UCDocument) {
		super();
	}

    private addCodeAction(codeAction: CodeAction): void {
        this.codeActions.push(codeAction);
    }

    visitObjectType(symbol: UCObjectTypeSymbol) {
        const referredSymbol = symbol.getRef();
		if (!referredSymbol) {
            if ((symbol.getValidTypeKind() & UCTypeFlags.Class) !== 0) {
                const documentUri = this.document.filePath;
                const newClassName = symbol.getName().text;
                const newFileName =  newClassName + '.uc';

                const uri = URI
                    .file(path.join(
                        documentUri.substring(0, documentUri.lastIndexOf(path.sep)),
                        newFileName))
                    .toString();

                this.addCodeAction({
                    title: 'Generate Class',
                    kind: CodeActionKind.RefactorExtract,
                    command: Command.create(
                        'Generate Type',
                        'create.class',
                        uri,
                        newClassName,
                    ),
                });
            } else {
                // TODO:
            }
        }
        super.visitObjectType(symbol);
    }
}