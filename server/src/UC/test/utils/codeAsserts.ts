import { fail } from 'assert';
import { expect } from 'chai';

import type { UCDocument } from '../../document';
import { IExpression, UCBinaryOperatorExpression } from '../../expressions';
import type { Name } from '../../name';
import { IStatement, UCExpressionStatement } from '../../statements';
import { ISymbol, type UCFieldSymbol, type UCSymbolKind } from '../../Symbols';
import { symbolKindToDisplayString } from '../../diagnostics/diagnostic';

export function assertExpressionStatement(stm: IStatement | undefined): UCExpressionStatement {
    if (!(stm instanceof UCExpressionStatement)) {
        return fail('invalid instance');
    }

    return stm as UCExpressionStatement;
}

export function assertExpressionMemberSymbol(expr: IExpression, expected: ISymbol): ISymbol {
    const symbol = expr.getMemberSymbol();
    expect(symbol)
        .to.equal(expected);

    return symbol;
}

export function assertBinaryOperatorExpressionMemberSymbol(
    expr: IExpression | undefined,
    expectedLeft: ISymbol,
    expectedRight: ISymbol
): UCBinaryOperatorExpression {
    if (!(expr instanceof UCBinaryOperatorExpression)) {
        return fail('invalid instance');
    }

    expect(expr.left.getMemberSymbol(), 'left')
        .to.equal(expectedLeft);
    expect(expr.right.getMemberSymbol(), 'right')
        .to.equal(expectedRight);

    return expr as UCBinaryOperatorExpression;
}

export function assertDocumentFieldSymbol<T extends UCFieldSymbol>(
    document: UCDocument,
    name: Name,
    kind?: UCSymbolKind
): T | undefined {
    const symbol = document.getSymbol<T>(name)
        ?? document.class?.getSymbol<T>(name);

    expect(symbol, name.text)
        .to.not.be.undefined;

    if (typeof kind !== 'undefined') {
        expect(symbol.kind, symbol.id.name.text)
            .to.be.equal(kind, symbolKindToDisplayString(kind));
    }

    return <T>symbol;
}
