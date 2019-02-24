import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { UCExpression, UCSymbolExpression, UCUnaryExpression, UCPrimaryExpression, UCAssignmentExpression, UCContextExpression, UCBinaryExpression } from './symbols/Expressions';
import { ExpressionContext, PrimaryExpressionContext, UnaryExpressionContext, OperatorIdContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext } from '../antlr/UCGrammarParser';
import { rangeFromBound, rangeFromBounds } from './helpers';
import { UCReferenceSymbol } from './symbols';
import { ParserRuleContext } from 'antlr4ts';

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
		const exprSymbol = new UCExpression({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		exprSymbol.context = ctx;

		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.expression = primaryExpression.accept(this);
			return exprSymbol;
		}

		const unaryExpression = ctx.unaryExpression();
		if (unaryExpression) {
			exprSymbol.expression = unaryExpression.accept(this);
			return exprSymbol;
		}

		const functionName = ctx.functionName();
		if (functionName) {
			exprSymbol.expression = this.visitBinaryExpression(ctx);
			return exprSymbol;
		}

		return exprSymbol;
	}

	visitBinaryExpression(ctx: ExpressionContext) {
		// TODO: custom class
		const exprSymbol = new UCBinaryExpression({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		exprSymbol.context = ctx;

		const leftExpression = ctx.expression(0);
		if (leftExpression) {
			exprSymbol.leftExpression = leftExpression.accept(this);
		}

		const rightExpression = ctx.expression(1);
		if (rightExpression) {
			exprSymbol.expression = rightExpression.accept(this);
		}

		return exprSymbol;
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext): UCAssignmentExpression {
		const exprSymbol = new UCAssignmentExpression({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		exprSymbol.context = ctx;

		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.leftExpression = primaryExpression.accept(this);
		}

		const expression = ctx.expression();
		if (expression) {
			exprSymbol.expression = expression.accept(this);
		}
		return exprSymbol;
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCExpression {
		const exprSymbol = new UCUnaryExpression({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		exprSymbol.context = ctx;
		exprSymbol.expression = ctx.primaryExpression().accept(this);
		exprSymbol.operatorId = ctx.operatorId().accept(this);
		return exprSymbol;
	}

	visitPrimaryExpression(ctx: PrimaryExpressionContext): UCExpression {
		if (ctx.DOT()) {
			const exprSymbol = new UCContextExpression(
				{ name: '', range: rangeFromBounds(ctx.start, ctx.stop) }
			);
			exprSymbol.context = ctx;

			const primaryExpression = ctx.primaryExpression();
			if (primaryExpression) {
				exprSymbol.expression = primaryExpression.accept(this);
			}

			const id = (ctx.identifier() || ctx.classLiteralSpecifier()) as ParserRuleContext;
			if (id) {
				exprSymbol.symbolExpression = id.accept(this);
			}
			return exprSymbol;
		}

		const exprSymbol = new UCPrimaryExpression(
			{ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		exprSymbol.context = ctx;

		const id = (ctx.identifier()
			|| ctx.kwDEFAULT() || ctx.kwSELF()
			|| ctx.kwSUPER() || ctx.kwGLOBAL()
			|| ctx.kwSTATIC()) as ParserRuleContext;
		if (id) {
			exprSymbol.symbolExpression = this.visitIdentifier(id);
			return exprSymbol;
		}

		// e.g. a function call won't have a direct identifier but instead is nested within a primary expression!
		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.expression = primaryExpression.accept(this);
		}

		// ( expr )
		const expr = ctx.expression();
		if (expr) {
			exprSymbol.expression = expr.accept(this);
		}
		return exprSymbol;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(
			{ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		exprSymbol.context = ctx;
		exprSymbol.symbol = new UCReferenceSymbol({ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) });
		return exprSymbol;
	}

	visitIdentifier(ctx: ParserRuleContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(
			{ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		exprSymbol.context = ctx;
		exprSymbol.symbol = new UCReferenceSymbol({ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) });
		return exprSymbol;
	}

	visitOperatorId(ctx: OperatorIdContext): UCSymbolExpression {
		const exprSymbol = new UCSymbolExpression(
			{ name: ctx.text, range: rangeFromBound(ctx.start) }
		);
		exprSymbol.context = ctx;
		exprSymbol.symbol = new UCReferenceSymbol({ name: ctx.text, range: rangeFromBounds(ctx.start, ctx.stop) });
		return exprSymbol;
	}
}