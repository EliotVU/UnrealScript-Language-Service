import { CodeAction, CodeActionKind, Command } from 'vscode-languageserver';

import { CommandIdentifier } from 'commands';
import { UCObjectTypeSymbol, UCSymbolKind, isConstSymbol, tryFindClassSymbol } from './UC/Symbols';
import { UCDocument } from './UC/document';
import { IExpression, UCLiteral } from './UC/expressions';
import { DefaultSymbolWalker } from './UC/symbolWalker';

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
        if (referredSymbol) {
            if (isConstSymbol(referredSymbol)) {
                const evaluatedValue = referredSymbol.getComputedValue();
                if (typeof evaluatedValue === 'undefined') {
                    return;
                }

                this.addCodeAction({
                    title: 'Inline constant',
                    kind: CodeActionKind.RefactorInline,
                    command: Command.create(
                        'Inline constant',
                        CommandIdentifier.Inline, {
                        uri: this.document.uri,
                        range: symbol.range,
                        newText: evaluatedValue.toString()
                    }),
                });
            }
        } else {
            // No symbol found, let's try see if we could provide a command to create a class
            // TODO: What about qualified identifiers?
            const classSymbol = tryFindClassSymbol(symbol.getName(), UCSymbolKind.Class);
            if (classSymbol) {
                return;
            }

            //

            const className = symbol.getName().text;

            this.addCodeAction({
                title: 'Create class',
                kind: CodeActionKind.RefactorExtract,
                command: Command.create(
                    'Create class',
                    CommandIdentifier.CreateClass, {
                    uri: this.document.uri,
                    className,
                }),
            });
        }

        super.visitObjectType(symbol);
    }

    override visitExpression(expr: IExpression): void {
        // !! Placeholder, this code is not active
        return;

        if (expr instanceof UCLiteral) {
            const literalType = expr.getType();
            if (!literalType) {
                // invalid type, unworkable.
                return;
            }

            const literalValue = expr.getValue();
            if (!literalValue) {
                // not computable
                return;
            }

            // Find the best matching `Const`
            const compatibleConst = this.document.class?.findSuperSymbolPredicate(symbol => {
                return isConstSymbol(symbol)
                    && symbol.getType()?.getTypeKind() === literalType.getTypeKind()
                    && symbol.getComputedValue() === literalValue;
            });

            if (compatibleConst) {
                const range = expr.range;
                const newText = compatibleConst.getName().text;

                const documentUri = this.document.uri;
                this.addCodeAction({
                    title: 'Displace with constant',
                    kind: CodeActionKind.RefactorInline,
                    command: Command.create(
                        'Displace with constant',
                        CommandIdentifier.Inline,
                        { uri: documentUri, range, newText }
                    ),
                });
            }
        }
    }
}
