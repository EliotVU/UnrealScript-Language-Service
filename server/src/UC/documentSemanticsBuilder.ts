import {
    Range, SemanticTokenModifiers, SemanticTokens, SemanticTokensBuilder, SemanticTokenTypes
} from 'vscode-languageserver/node';

import { UCDocument } from './document';
import {
    IExpression, UCArrayCountExpression, UCBaseOperatorExpression, UCBinaryOperatorExpression,
    UCCallExpression, UCConditionalExpression, UCDefaultMemberCallExpression,
    UCDefaultStructLiteral, UCElementAccessExpression, UCMemberExpression, UCMetaClassExpression,
    UCNameOfExpression, UCObjectLiteral, UCParenthesizedExpression, UCPredefinedAccessExpression,
    UCPropertyAccessExpression, UCSizeOfLiteral, UCSuperExpression
} from './expressions';
import { UCBlock, UCGotoStatement, UCLabeledStatement, UCRepIfStatement } from './statements';
import {
    Identifier, isField, isFunction, ISymbol, MethodFlags, ModifierFlags, UCObjectTypeSymbol,
    UCSymbolKind, UCTypeKind
} from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

export const TokenTypes = [
    SemanticTokenTypes.class,
    SemanticTokenTypes.interface,
    SemanticTokenTypes.namespace,
    SemanticTokenTypes.struct,
    SemanticTokenTypes.enum,
    SemanticTokenTypes.enumMember,
    SemanticTokenTypes.function,
    SemanticTokenTypes.parameter,
    SemanticTokenTypes.variable,
    SemanticTokenTypes.property,
    SemanticTokenTypes.keyword,
    SemanticTokenTypes.string,
    SemanticTokenTypes.operator,
    SemanticTokenTypes.event,
];

export const TokenModifiers = [
    SemanticTokenModifiers.declaration,
    SemanticTokenModifiers.definition,
    SemanticTokenModifiers.readonly,
    SemanticTokenModifiers.static,
    SemanticTokenModifiers.deprecated,
    SemanticTokenModifiers.defaultLibrary,
    TokenModifiersExtended.intrinsic,
    TokenModifiersExtended.native
];

const enum TokenModifiersExtended
{
    intrinsic = "intrinsic",
    native = "native",
}

export const TokenTypesMap = {
    [SemanticTokenTypes.class]: 0,
    [SemanticTokenTypes.interface]: 1,
    [SemanticTokenTypes.namespace]: 2,
    [SemanticTokenTypes.struct]: 3,
    [SemanticTokenTypes.enum]: 4,
    [SemanticTokenTypes.enumMember]: 5,
    [SemanticTokenTypes.function]: 6,
    [SemanticTokenTypes.parameter]: 7,
    [SemanticTokenTypes.variable]: 8,
    [SemanticTokenTypes.property]: 9,
    [SemanticTokenTypes.keyword]: 10,
    [SemanticTokenTypes.string]: 11,
    [SemanticTokenTypes.operator]: 12,
    [SemanticTokenTypes.event]: 13,
};

export const TokenModifiersMap = {
    [SemanticTokenModifiers.declaration]: 0,
    [SemanticTokenModifiers.definition]: 1,
    [SemanticTokenModifiers.readonly]: 2,
    [SemanticTokenModifiers.static]: 3,
    [SemanticTokenModifiers.deprecated]: 4,
    [SemanticTokenModifiers.defaultLibrary]: 5,
    [TokenModifiersExtended.intrinsic]: 6,
    [TokenModifiersExtended.native]: 7,
};

export const SymbolToTokenTypeIndexMap = {
    [UCSymbolKind.Class]: TokenTypesMap[SemanticTokenTypes.class],
    [UCSymbolKind.Interface]: TokenTypesMap[SemanticTokenTypes.interface],
    [UCSymbolKind.Package]: TokenTypesMap[SemanticTokenTypes.namespace],
    [UCSymbolKind.ScriptStruct]: TokenTypesMap[SemanticTokenTypes.struct],
    [UCSymbolKind.Enum]: TokenTypesMap[SemanticTokenTypes.enum],
    [UCSymbolKind.EnumTag]: TokenTypesMap[SemanticTokenTypes.enumMember],
    [UCSymbolKind.Function]: TokenTypesMap[SemanticTokenTypes.function],
    [UCSymbolKind.Event]: TokenTypesMap[SemanticTokenTypes.event],
    [UCSymbolKind.Delegate]: TokenTypesMap[SemanticTokenTypes.function],
    [UCSymbolKind.Operator]: TokenTypesMap[SemanticTokenTypes.operator],
    [UCSymbolKind.Property]: TokenTypesMap[SemanticTokenTypes.property],
    [UCSymbolKind.Parameter]: TokenTypesMap[SemanticTokenTypes.parameter],
    [UCSymbolKind.Local]: TokenTypesMap[SemanticTokenTypes.variable],
    [UCSymbolKind.Const]: TokenTypesMap[SemanticTokenTypes.property],
    // TODO: Custom type for archetypes?
    [UCSymbolKind.Archetype]: TokenTypesMap[SemanticTokenTypes.property],
};

export const TypeToTokenTypeIndexMap = {
    [UCTypeKind.String]: TokenTypesMap[SemanticTokenTypes.string],
};

export class DocumentSemanticsBuilder extends DefaultSymbolWalker<undefined> {
    private semanticTokensBuilder = new SemanticTokensBuilder();

    constructor(private document: UCDocument) {
        super();
    }

    private getTokens() {
        return this.semanticTokensBuilder.build();
    }

    private pushIdentifier(id: Identifier, type: number, modifiers: number): void {
        const range = id.range;
        this.semanticTokensBuilder.push(
            range.start.line,
            range.start.character,
            range.end.character - range.start.character,
            type,
            modifiers
        );
    }

    private pushRange(range: Range, type: number, modifiers: number): void {
        this.semanticTokensBuilder.push(
            range.start.line,
            range.start.character,
            range.end.character - range.start.character,
            type,
            modifiers
        );
    }

    private pushSymbol(symbol: ISymbol, id: Identifier): void {
        if (symbol.getTypeKind() === UCTypeKind.Name) {
            this.pushIdentifier(id,
                TypeToTokenTypeIndexMap[UCTypeKind.String],
                1 << TokenModifiersMap[SemanticTokenModifiers.static]
            );
            return;
        }

        let type: number | undefined = (SymbolToTokenTypeIndexMap as any)[symbol.kind];
        if (typeof type !== 'undefined') {
            let modifiers = 0;
            if (isField(symbol)) {
                if (symbol.modifiers & ModifierFlags.ReadOnly) {
                    modifiers |= 1 << TokenModifiersMap[SemanticTokenModifiers.readonly];
                }
                if (symbol.modifiers & ModifierFlags.Intrinsic) {
                    modifiers |= 1 << TokenModifiersMap[SemanticTokenModifiers.defaultLibrary];
                }

                if (isFunction(symbol)) {
                    if (symbol.specifiers & MethodFlags.Static) {
                        modifiers |= 1 << TokenModifiersMap[SemanticTokenModifiers.static];
                    }

                    if (symbol.modifiers & ModifierFlags.Keyword) {
                        type = TokenTypesMap[SemanticTokenTypes.keyword];
                    } else if (symbol.specifiers & MethodFlags.OperatorKind) {
                        type = TokenTypesMap[SemanticTokenTypes.operator];
                    }
                }
            }
            this.pushIdentifier(id, type, modifiers);
        }
    }

    visitDocument(document: UCDocument): SemanticTokens {
        super.visitDocument(document);
        return this.getTokens();
    }

    visitBlock(symbol: UCBlock) {
        for (const statement of symbol.statements) {
            if (statement) {
                statement.accept(this);
            }
        }
    }

    visitObjectType(symbol: UCObjectTypeSymbol) {
        const symbolRef = symbol.getRef();
        if (symbolRef) {
            this.pushSymbol(symbolRef, symbol.id);
        }
        super.visitObjectType(symbol);
    }

    visitGotoStatement(stm: UCGotoStatement) {
        // super.visitGotoStatement(stm);
        if (stm.expression) {
            const type = stm.expression.getType();
            if (type && type.getTypeKind() === UCTypeKind.Name) {
                this.pushRange(type.id.range,
                    TypeToTokenTypeIndexMap[UCTypeKind.String],
                    1 << TokenModifiersMap[SemanticTokenModifiers.readonly]
                );
            }
            stm.expression.accept(this);
        }
    }

    visitLabeledStatement(stm: UCLabeledStatement) {
        super.visitLabeledStatement(stm);
        if (stm.label) {
            this.pushRange(stm.label.range,
                TypeToTokenTypeIndexMap[UCTypeKind.String],
                1 << TokenModifiersMap[SemanticTokenModifiers.readonly]
            );
        }
    }

    visitRepIfStatement(stm: UCRepIfStatement): void {
        super.visitRepIfStatement(stm);
        if (stm.symbolRefs)
            for (const repSymbolRef of stm.symbolRefs) {
                const symbolRef = repSymbolRef.getRef();
                if (symbolRef) {
                    this.pushSymbol(symbolRef, repSymbolRef.id);
                }
            }
    }

    // FIXME: DRY
    // FIXME: Infinite loop in Test.uc
    visitExpression(expr: IExpression) {
        if (expr instanceof UCParenthesizedExpression) {
            expr.expression?.accept(this);
        } else if (expr instanceof UCMetaClassExpression) {
            expr.classRef?.accept(this);
            expr.expression?.accept(this);
        } else if (expr instanceof UCCallExpression) {
            expr.expression.accept(this);
            expr.arguments?.forEach(arg => arg.accept(this));
        } else if (expr instanceof UCElementAccessExpression) {
            expr.expression?.accept(this);
            expr.argument?.accept(this);
        } else if (expr instanceof UCPropertyAccessExpression) {
            expr.left.accept(this);
            expr.member?.accept(this);
        } else if (expr instanceof UCConditionalExpression) {
            expr.condition.accept(this);
            expr.true?.accept(this);
            expr.false?.accept(this);
        } else if (expr instanceof UCBaseOperatorExpression) {
            expr.expression?.accept(this);
        } else if (expr instanceof UCBinaryOperatorExpression) {
            expr.left?.accept(this);
            expr.right?.accept(this);
        } else if (expr instanceof UCDefaultMemberCallExpression) {
            expr.propertyMember.accept(this);
            expr.operationMember.accept(this);
            const symbolRef = expr.operationMember.getRef();
            if (symbolRef) {
                this.pushSymbol(symbolRef, expr.operationMember.id);
            }
            expr.arguments?.forEach(arg => arg.accept(this));
        } else if (expr instanceof UCMemberExpression) {
            expr.type?.accept(this);
        } else if (expr instanceof UCPredefinedAccessExpression) {
            // Disabled for now, it doesn't look that pretty when namespace tokens are colored like a class type.
            // if (expr.id.name !== NAME_SELF) {
            //     this.pushSymbol(expr.typeRef,
            //         TokenTypesMap[SemanticTokenTypes.namespace],
            //         TokenModifiersMap[SemanticTokenModifiers.readonly]
            //     );
            // }
        } else if (expr instanceof UCSuperExpression) {
            expr.structTypeRef?.accept(this);
        } else if (expr instanceof UCDefaultStructLiteral) {
            expr.arguments?.forEach(arg => arg?.accept(this));
        } else if (expr instanceof UCObjectLiteral) {
            expr.objectRef?.accept(this);
        } else if (expr instanceof UCArrayCountExpression) {
            expr.argument?.accept(this);
        } else if (expr instanceof UCNameOfExpression) {
            expr.argument?.accept(this);
        } else if (expr instanceof UCSizeOfLiteral) {
            expr.argumentRef?.accept(this);
        }
        return super.visitExpression(expr);
    }
}
