import { ParserRuleContext } from 'antlr4ts';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { PrimaryExpressionContext, UnaryExpressionContext, OperatorIdContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext, ArgumentsContext, ArgumentContext, BinaryOperatorContext, UnaryOperatorContext, PrimaryOperatorContext, TernaryOperatorContext } from '../antlr/UCGrammarParser';

import { UCSymbolReference } from './symbols';
import { UCExpression, UCMemberExpression, UCUnaryExpression, UCPrimaryExpression, UCAssignmentExpression, UCContextExpression, UCBinaryExpression, UCTernaryExpression } from './symbols/Expressions';
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

	visitExpression(ctx: BinaryOperatorContext | UnaryOperatorContext | TernaryOperatorContext): UCExpression {
		return ctx.accept(this);
	}

	visitTernaryOperator(ctx: TernaryOperatorContext) {
		const exprSymbol = new UCTernaryExpression();
		exprSymbol.context = ctx;

		const condition = ctx.expression(0);
		if (condition) {
			exprSymbol.condition = condition.accept<UCExpression>(this);
			exprSymbol.condition.outer = exprSymbol;
		}

		const leftExpression = ctx.expression(1);
		if (leftExpression) {
			exprSymbol.left = leftExpression.accept<UCExpression>(this);
			exprSymbol.left.outer = exprSymbol;
		}

		const rightExpression = ctx.expression(2);
		if (rightExpression) {
			exprSymbol.right = rightExpression.accept<UCExpression>(this);
			exprSymbol.right.outer = exprSymbol;
		}

		return exprSymbol;
	}

	visitBinaryOperator(ctx: BinaryOperatorContext) {
		const exprSymbol = new UCBinaryExpression();
		exprSymbol.context = ctx;

		const leftExpression = ctx.expression(0);
		if (leftExpression) {
			exprSymbol.left = leftExpression.accept<UCExpression>(this);
			exprSymbol.left.outer = exprSymbol;
		}

		const rightExpression = ctx.expression(1);
		if (rightExpression) {
			exprSymbol.right = rightExpression.accept<UCExpression>(this);
			exprSymbol.right.outer = exprSymbol;
		}

		return exprSymbol;
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext): UCAssignmentExpression {
		const exprSymbol = new UCAssignmentExpression();
		exprSymbol.context = ctx;

		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			exprSymbol.left = primaryExpression.accept(this);
			exprSymbol.left.outer = exprSymbol;
		}

		const expression = ctx.expression();
		if (expression) {
			exprSymbol.right = expression.accept(this);
			exprSymbol.right.outer = exprSymbol;
		}
		return exprSymbol;
	}

	visitUnaryOperator(ctx: UnaryOperatorContext): UCUnaryExpression {
		return ctx.unaryExpression().accept(this);
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCUnaryExpression {
		const exprSymbol = new UCUnaryExpression();
		exprSymbol.context = ctx;
		exprSymbol.expression = ctx.primaryExpression().accept(this);
		exprSymbol.expression.outer = exprSymbol;
		exprSymbol.operatorId = ctx.operatorId().accept(this);
		exprSymbol.operatorId.outer = exprSymbol;
		return exprSymbol;
	}

	visitPrimaryOperator(ctx: PrimaryOperatorContext): UCPrimaryExpression {
		return ctx.primaryExpression().accept(this);
	}

	visitPrimaryExpression(ctx: PrimaryExpressionContext): UCPrimaryExpression {
		if (ctx.DOT()) {
			const exprSymbol = new UCContextExpression();
			exprSymbol.context = ctx;

			const primaryExpression = ctx.primaryExpression();
			if (primaryExpression) {
				exprSymbol.left = primaryExpression.accept<UCExpression>(this);
				exprSymbol.left.outer = exprSymbol;
			}

			const id = (ctx.identifier() || ctx.classLiteralSpecifier()) as ParserRuleContext;
			if (id) {
				exprSymbol.member = id.accept(this);
				exprSymbol.member.outer = exprSymbol;
			}
			return exprSymbol;
		}

		// Handles the following grammar
		// | castClassLimiter primaryExpression
		// | primaryExpression OPEN_PARENS arguments CLOSE_PARENS
		// | primaryExpression OPEN_BRACKET expression CLOSE_BRACKET
		const primaryExpression = ctx.primaryExpression();
		if (primaryExpression) {
			const exprSymbol = primaryExpression.accept(this) as UCPrimaryExpression;
			exprSymbol['range'] = rangeFromBounds(ctx.start, ctx.stop);

			const expr = ctx.expression();
			if (expr) {
				exprSymbol.withIndex = true;
				exprSymbol.expression = expr.accept<UCExpression>(this);
				exprSymbol.expression.outer = exprSymbol;
			}

			const exprArguments = ctx.arguments();
			if (exprArguments) {
				exprSymbol.arguments = exprArguments.accept(this) as UCExpression[];
				exprSymbol.withArgument = true;
			}

			if (ctx.castClassLimiter()) {
				// TODO: unhandled case
			}
			return exprSymbol;
		}

		const exprSymbol = new UCPrimaryExpression();
		exprSymbol.context = ctx;

		const id = (ctx.identifier()
			|| ctx.kwDEFAULT() || ctx.kwSELF()
			|| ctx.kwSUPER() || ctx.kwGLOBAL()
			|| ctx.kwSTATIC()) as ParserRuleContext;
		if (id) {
			exprSymbol.member = this.visitIdentifier(id);
			exprSymbol.member.outer = exprSymbol;
			return exprSymbol;
		}

		// ( expr )
		const expr = ctx.expression();
		if (expr) {
			exprSymbol.expression = expr.accept(this);
			exprSymbol.expression.outer = exprSymbol;
		}
		return exprSymbol;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const exprSymbol = new UCMemberExpression(range);
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCSymbolReference(ctx.text, range));
		return exprSymbol;
	}

	visitIdentifier(ctx: ParserRuleContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const exprSymbol = new UCMemberExpression(range);
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCSymbolReference(ctx.text, range));
		return exprSymbol;
	}

	visitOperatorId(ctx: OperatorIdContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const exprSymbol = new UCMemberExpression(range);
		exprSymbol.context = ctx;
		exprSymbol.setSymbol(new UCSymbolReference(ctx.text, range));
		return exprSymbol;
	}

	visitArguments(ctx: ArgumentsContext): UCExpression {
		const exprArgument = ctx.argument();
		if (!exprArgument) {
			return undefined;
		}

		const exprArguments: UCExpression[] = [];
		for (let arg of exprArgument) {
			exprArguments.push(arg.accept<UCExpression>(this));
		}
		return exprArguments as any as UCExpression;
	}

	visitArgument(ctx: ArgumentContext): UCExpression {
		return ctx.expression().accept<UCExpression>(this);
	}
}