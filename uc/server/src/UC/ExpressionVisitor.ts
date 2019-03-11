import { ParserRuleContext } from 'antlr4ts';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { ExpressionContext, PrimaryExpressionContext, UnaryExpressionContext, OperatorIdContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext } from '../antlr/UCGrammarParser';

import { UCReferenceSymbol } from './symbols';
import { UCExpression, UCSymbolExpression, UCUnaryExpression, UCPrimaryExpression, UCAssignmentExpression, UCContextExpression, UCBinaryExpression } from './symbols/Expressions';
import { rangeFromBounds } from './helpers';

export class UCExpressionVisitor implements UCGrammarVisitor<UCExpression> {
	visitChildren(ctx) {
		return undefined;
	}

	visitTerminal(ctx) {
		return undefined;
	}

	visitErrorNode(ctx) {
		return undefined;
	}

	visit(ctx) {
		return undefined;
	}

	visitStatement(ctx: StatementContext): UCExpression {
		const expr = ctx.expression();
		if (expr) {
			return expr.accept(this);
		}

		const assign = ctx.assignmentExpression();
		if (assign) {
			return assign.accept(this);
		}
		return undefined;
	}

	visitExpression(ctx: ExpressionContext): UCExpression {
		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			return primaryExpression.accept(this);
		}

		const unaryExpression = ctx.unaryExpression();
		if (unaryExpression) {
			return unaryExpression.accept(this);
		}

		const functionName = ctx.functionName();
		if (functionName) {
			return this.visitBinaryExpression(ctx);
		}
		return undefined;
	}

	visitBinaryExpression(ctx: ExpressionContext) {
		const exprSymbol = new UCBinaryExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;

		const leftExpression = ctx.expression(0);
		if (leftExpression) {
			exprSymbol.leftExpression = leftExpression.accept(this);
			exprSymbol.leftExpression.outer = exprSymbol;
		}

		const rightExpression = ctx.expression(1);
		if (rightExpression) {
			exprSymbol.expression = rightExpression.accept(this);
			exprSymbol.expression.outer = exprSymbol;
		}

		return exprSymbol;
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext): UCAssignmentExpression {
		const exprSymbol = new UCAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;

		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.leftExpression = primaryExpression.accept(this);
			exprSymbol.leftExpression.outer = exprSymbol;
		}

		const expression = ctx.expression();
		if (expression) {
			exprSymbol.expression = expression.accept(this);
			exprSymbol.expression.outer = exprSymbol;
		}
		return exprSymbol;
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCExpression {
		const exprSymbol = new UCUnaryExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;
		exprSymbol.expression = ctx.primaryExpression().accept(this);
		exprSymbol.expression.outer = exprSymbol;
		exprSymbol.operatorId = ctx.operatorId().accept(this);
		exprSymbol.operatorId.outer = exprSymbol;
		return exprSymbol;
	}

	visitPrimaryExpression(ctx: PrimaryExpressionContext): UCExpression {
		if (ctx.DOT()) {
			const exprSymbol = new UCContextExpression(rangeFromBounds(ctx.start, ctx.stop));
			exprSymbol.context = ctx;

			const primaryExpression = ctx.primaryExpression();
			if (primaryExpression) {
				exprSymbol.expression = primaryExpression.accept(this);
				exprSymbol.expression.outer = exprSymbol;
			}

			const id = (ctx.identifier() || ctx.classLiteralSpecifier()) as ParserRuleContext;
			if (id) {
				exprSymbol.symbolExpression = id.accept(this);
				exprSymbol.symbolExpression.outer = exprSymbol;
			}
			return exprSymbol;
		}

		const exprSymbol = new UCPrimaryExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;

		const id = (ctx.identifier()
			|| ctx.kwDEFAULT() || ctx.kwSELF()
			|| ctx.kwSUPER() || ctx.kwGLOBAL()
			|| ctx.kwSTATIC()) as ParserRuleContext;
		if (id) {
			exprSymbol.symbolExpression = this.visitIdentifier(id);
			exprSymbol.symbolExpression.outer = exprSymbol;
			return exprSymbol;
		}

		// e.g. a function call won't have a direct identifier but instead is nested within a primary expression!
		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.expression = primaryExpression.accept(this);
			exprSymbol.expression.outer = exprSymbol;
		}

		// ( expr )
		const expr = ctx.expression();
		if (expr) {
			exprSymbol.expression = expr.accept(this);
			exprSymbol.expression.outer = exprSymbol;
		}
		return exprSymbol;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCReferenceSymbol(ctx.text, rangeFromBounds(ctx.start, ctx.stop)));
		return exprSymbol;
	}

	visitIdentifier(ctx: ParserRuleContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCReferenceSymbol(ctx.text, rangeFromBounds(ctx.start, ctx.stop)));
		return exprSymbol;
	}

	visitOperatorId(ctx: OperatorIdContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(rangeFromBounds(ctx.start, ctx.stop));
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCReferenceSymbol(ctx.text, rangeFromBounds(ctx.start, ctx.stop)));
		return exprSymbol;
	}
}