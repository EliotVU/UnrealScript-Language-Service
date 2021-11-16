import {
    SemanticTokenModifiers, SemanticTokens, SemanticTokensBuilder, SemanticTokenTypes
} from 'vscode-languageserver/node';

import { UCDocument } from './UC/document';
import { IExpression, UCCallExpression, UCMemberExpression } from './UC/expressions';
import { getDocumentByURI } from './UC/indexer';
import { UCBlock } from './UC/statements';
import { ISymbol, UCObjectTypeSymbol, UCSymbol, UCTypeFlags } from './UC/Symbols';
import { DefaultSymbolWalker } from './UC/symbolWalker';

export const TokenTypes = [
    SemanticTokenTypes.class,
    SemanticTokenTypes.interface,
    SemanticTokenTypes.namespace,
    SemanticTokenTypes.struct,
    SemanticTokenTypes.enum,
    SemanticTokenTypes.enumMember,
    SemanticTokenTypes.function,
];

export const TokenModifiers = [
    SemanticTokenModifiers.definition
];

const TokenTypesMap = {
    [SemanticTokenTypes.class]: 0,
    [SemanticTokenTypes.interface]: 1,
    [SemanticTokenTypes.namespace]: 2,
    [SemanticTokenTypes.struct]: 3,
    [SemanticTokenTypes.enum]: 4,
    [SemanticTokenTypes.enumMember]: 5,
    [SemanticTokenTypes.function]: 6,
};

const TokenModifiersMap = {
    [SemanticTokenModifiers.definition]: 0,
};

const TypeToTokenTypeIndexMap = {
    [UCTypeFlags.Class]: TokenTypesMap[SemanticTokenTypes.class],
    [UCTypeFlags.Interface]: TokenTypesMap[SemanticTokenTypes.interface],
    [UCTypeFlags.Package]: TokenTypesMap[SemanticTokenTypes.namespace],
    [UCTypeFlags.Struct]: TokenTypesMap[SemanticTokenTypes.struct],
    [UCTypeFlags.Enum]: TokenTypesMap[SemanticTokenTypes.enum],
    [UCTypeFlags.Byte]: TokenTypesMap[SemanticTokenTypes.enumMember],
    [UCTypeFlags.Function]: TokenTypesMap[SemanticTokenTypes.function],
};

export class DocumentSemanticsBuilder extends DefaultSymbolWalker {
    private semanticTokensBuilder = new SemanticTokensBuilder();

    constructor(private document: UCDocument) {
        super();
    }

    public getTokens() {
        return this.semanticTokensBuilder.build();
    }

    private pushSymbol(symbol: UCSymbol, types: UCTypeFlags): void {
        const type = TypeToTokenTypeIndexMap[types];
        if (typeof type === 'undefined') {
            return;
        }

        const idRange = symbol.getRange();
        const modifier = TokenModifiersMap[SemanticTokenModifiers.definition];
        this.semanticTokensBuilder.push(
            idRange.start.line,
            idRange.start.character,
            idRange.end.character - idRange.start.character,
            type,
            modifier
        );
    }

    visitBlock(symbol: UCBlock) {
        for (let statement of symbol.statements) if (statement) {
            statement.accept(this);
        }
        return undefined;
    }

    visitObjectType(symbol: UCObjectTypeSymbol): ISymbol {
        if (symbol.getRef() && (symbol.getTypeFlags() & UCTypeFlags.Object) !== 0) {
            this.pushSymbol(symbol, symbol.getTypeFlags());
        }
        return super.visitObjectType(symbol);
    }

    visitExpression(expr: IExpression) {
        if (expr instanceof UCCallExpression) {
            expr.expression.accept(this);
            expr.arguments?.forEach(arg => arg.accept(this));
        } else if (expr instanceof UCMemberExpression) {
            expr.typeRef?.accept(this);
        }
        return super.visitExpression(expr);
    }
}

export async function getSemanticTokens(uri: string): Promise<SemanticTokens> {
    const document = getDocumentByURI(uri);
    if (!document) {
        return {
            data: []
        };
    }

    const walker = new DocumentSemanticsBuilder(document);
    document.accept(walker);

    return walker.getTokens();
}