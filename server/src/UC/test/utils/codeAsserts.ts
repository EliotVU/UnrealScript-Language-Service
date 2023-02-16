import { fail } from 'assert';
import { expect } from 'chai';

import { IExpression, UCBinaryOperatorExpression } from '../../expressions';
import { IStatement, UCExpressionStatement } from '../../statements';
import { ISymbol } from '../../Symbols';

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
    expectedRight: ISymbol): UCBinaryOperatorExpression {
    if (!(expr instanceof UCBinaryOperatorExpression)) {
        return fail('invalid instance');
    }

    expect(expr.left.getMemberSymbol(), 'left')
        .to.equal(expectedLeft);
    expect(expr.right.getMemberSymbol(), 'right')
        .to.equal(expectedRight);

    return expr as UCBinaryOperatorExpression;
}