import {
    Range,
    SemanticTokenModifiers,
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokenTypes,
} from 'vscode-languageserver/node';

import { UCDocument } from './document';
import {
    IExpression,
    UCArrayCountExpression,
    UCBaseOperatorExpression,
    UCBinaryOperatorExpression,
    UCCallExpression,
    UCConditionalExpression,
    UCDefaultMemberCallExpression,
    UCDefaultStructLiteral,
    UCElementAccessExpression,
    UCIdentifierLiteralExpression,
    UCMemberExpression,
    UCMetaClassExpression,
    UCNameOfExpression,
    UCNewExpression,
    UCObjectLiteral,
    UCParenthesizedExpression,
    UCPredefinedAccessExpression,
    UCPropertyAccessExpression,
    UCSizeOfLiteral,
    UCSuperExpression,
} from './expressions';
import { areRangesIntersecting } from './helpers';
import { UCBlock, UCGotoStatement, UCLabeledStatement, UCRepIfStatement } from './statements';
import {
    DEFAULT_RANGE,
    Identifier,
    isClass,
    isField,
    isFunction,
    ISymbol,
    MethodFlags,
    ModifierFlags,
    UCClassSymbol,
    UCConstSymbol,
    UCEnumSymbol,
    UCFieldSymbol,
    UCInterfaceSymbol,
    UCMethodSymbol,
    UCObjectTypeSymbol,
    UCParamSymbol,
    UCPropertySymbol,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
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
    TokenTypesExtended.archetype
];

const enum TokenTypesExtended {
    archetype = "archetype",
}

export const TokenModifiers = [
    SemanticTokenModifiers.declaration,
    SemanticTokenModifiers.definition,
    SemanticTokenModifiers.readonly,
    SemanticTokenModifiers.static,
    SemanticTokenModifiers.deprecated,
    SemanticTokenModifiers.defaultLibrary,
    TokenModifiersExtended.intrinsic,
    TokenModifiersExtended.native,
];

const enum TokenModifiersExtended {
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
    [TokenTypesExtended.archetype]: 14,
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
    [UCSymbolKind.Event]: TokenTypesMap[SemanticTokenTypes.function/* event */],
    [UCSymbolKind.Delegate]: TokenTypesMap[SemanticTokenTypes.function],
    [UCSymbolKind.Operator]: TokenTypesMap[SemanticTokenTypes.operator],
    [UCSymbolKind.Property]: TokenTypesMap[SemanticTokenTypes.property],
    [UCSymbolKind.Parameter]: TokenTypesMap[SemanticTokenTypes.parameter],
    [UCSymbolKind.Local]: TokenTypesMap[SemanticTokenTypes.variable],
    [UCSymbolKind.Const]: TokenTypesMap[SemanticTokenTypes.property],
    [UCSymbolKind.Archetype]: TokenTypesMap[TokenTypesExtended.archetype],
};

export const TypeToTokenTypeIndexMap = {
    [UCTypeKind.String]: TokenTypesMap[SemanticTokenTypes.string],
};

export class DocumentSemanticsBuilder extends DefaultSymbolWalker<undefined> {
    private semanticTokensBuilder = new SemanticTokensBuilder();

    constructor(private range?: Range) {
        super();
    }

    private getTokens() {
        return this.semanticTokensBuilder.build();
    }

    private pushIdentifier(id: Identifier, type: number, modifiers: number): void {
        const range = id.range;
        if (range === DEFAULT_RANGE) {
            return;
        }

        if (!id.name.text) {
            return;
        }

        this.semanticTokensBuilder.push(
            range.start.line,
            range.start.character,
            range.end.character - range.start.character,
            type,
            modifiers
        );
    }

    private pushRange(range: Range, type: number, modifiers: number): void {
        if (range === DEFAULT_RANGE) {
            return;
        }
        this.semanticTokensBuilder.push(
            range.start.line,
            range.start.character,
            range.end.character - range.start.character,
            type,
            modifiers
        );
    }

    private pushSymbol(symbol: ISymbol, id: Identifier): void {
        let type: number | undefined = (SymbolToTokenTypeIndexMap as any)[symbol.kind];
        if (typeof type !== 'undefined') {
            let modifiers = 0;
            if (isField(symbol)) {
                if (symbol.modifiers & ModifierFlags.ReadOnly) {
                    modifiers |= 1 << TokenModifiersMap[SemanticTokenModifiers.readonly];
                }
                if (symbol.modifiers & ModifierFlags.Intrinsic) {
                    modifiers |= 1 << TokenModifiersMap[SemanticTokenModifiers.defaultLibrary];
                    modifiers |= 1 << TokenModifiersMap[TokenModifiersExtended.intrinsic];
                }
                if (symbol.modifiers & ModifierFlags.Native) {
                    modifiers |= 1 << TokenModifiersMap[TokenModifiersExtended.native];
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

    override visitDocument(document: UCDocument): SemanticTokens {
        if (typeof this.range === 'undefined') {
            super.visitDocument(document);
        } else {
            const symbols = document.enumerateSymbols();
            for (const symbol of symbols) {
                symbol.accept(this);
            }
        }

        return this.getTokens();
    }

    override visitStructBase(symbol: UCStructSymbol) {
        if (symbol.children) {
            const symbols: ISymbol[] = Array(symbol.childrenCount());

            for (let child: UCFieldSymbol | undefined = symbol.children, i = 0; child; child = child.next, ++i) {
                symbols[i] = child;
            }

            for (let i = symbols.length - 1; i >= 0; --i) {
                if (this.range && !areRangesIntersecting(symbol.range, this.range)) {
                    continue;
                }

                symbols[i].accept(this);
            }
        }

        if (symbol.block) {
            symbol.block.accept(this);
        }
    }

    override visitClass(symbol: UCClassSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitClass(symbol);
    }

    override visitInterface(symbol: UCInterfaceSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitInterface(symbol);
    }

    override visitConst(symbol: UCConstSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitConst(symbol);
    }

    override visitEnum(symbol: UCEnumSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitEnum(symbol);
    }

    override visitScriptStruct(symbol: UCScriptStructSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitScriptStruct(symbol);
    }

    override visitProperty(symbol: UCPropertySymbol): void {
        if (symbol.type) {
            symbol.type.accept(this);
        }

        if ((symbol.modifiers & ModifierFlags.ReturnParam) === 0) {
            this.pushSymbol(symbol, symbol.id);
        }

        if (symbol.arrayDimRef) {
            symbol.arrayDimRef.accept(this);
        }

        // super.visitProperty(symbol);
    }

    override visitMethod(symbol: UCMethodSymbol): void {
        // Skip ahead to the type, because we have no identifier to highlight for this property.
        if (symbol.returnValue?.getType()) {
            symbol.returnValue.getType().accept(this);
        }

        this.pushSymbol(symbol, symbol.id);

        super.visitMethod(symbol);
    }

    override visitState(symbol: UCStateSymbol): void {
        this.pushSymbol(symbol, symbol.id);

        super.visitState(symbol);
    }

    override visitBlock(symbol: UCBlock) {
        if (this.range && !areRangesIntersecting(symbol.range, this.range)) {
            return;
        }

        for (const statement of symbol.statements) {
            if (statement) {
                statement.accept(this);
            }
        }
    }

    override visitObjectType(symbol: UCObjectTypeSymbol) {
        const symbolRef = symbol.getRef();
        if (symbolRef) {
            this.pushSymbol(symbolRef, symbol.id);
        }
        super.visitObjectType(symbol);
    }

    override visitGotoStatement(stm: UCGotoStatement) {
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

    override visitLabeledStatement(stm: UCLabeledStatement) {
        super.visitLabeledStatement(stm);
        if (stm.label) {
            this.pushRange(stm.label.range,
                TypeToTokenTypeIndexMap[UCTypeKind.String],
                1 << TokenModifiersMap[SemanticTokenModifiers.readonly]
            );
        }
    }

    override visitRepIfStatement(stm: UCRepIfStatement): void {
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
    override visitExpression(expr: IExpression) {
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
            expr.operator?.accept(this);
        } else if (expr instanceof UCBinaryOperatorExpression) {
            expr.left?.accept(this);
            expr.operator?.accept(this);
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
            if (expr.type && expr instanceof UCIdentifierLiteralExpression) {
                if (expr.type.getTypeKind() === UCTypeKind.Name) {
                    this.pushRange(expr.range,
                        TypeToTokenTypeIndexMap[UCTypeKind.String],
                        1 << TokenModifiersMap[SemanticTokenModifiers.static]
                    );
                    return;
                }
            }
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
            expr.classRef?.accept(this);
        } else if (expr instanceof UCArrayCountExpression) {
            expr.argument?.accept(this);
        } else if (expr instanceof UCNameOfExpression) {
            expr.argument?.accept(this);
        } else if (expr instanceof UCSizeOfLiteral) {
            expr.argumentRef?.accept(this);
        } else if (expr instanceof UCNewExpression) {
            expr.arguments?.forEach(arg => arg.accept(this));
            expr.expression.accept(this);
        }
        return super.visitExpression(expr);
    }
}
