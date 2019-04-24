import { ParserRuleContext } from 'antlr4ts';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { UnaryExpressionContext, OperatorContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext, ArgumentsContext, BinaryOperatorContext, UnaryOperatorContext, PrimaryOperatorContext, TernaryOperatorContext, ContextExpressionContext, MemberExpressionContext, ArgumentedExpressionContext, IndexExpressionContext, NewExpressionContext, ClassCastExpressionContext, SpecifierExpressionContext, LiteralExpressionContext, ClassArgumentContext, PreOperatorContext, ParenthesisExpressionContext } from '../antlr/UCGrammarParser';

import { UCSymbolReference } from './Symbols';
import { UCMemberExpression, UCUnaryOperator, UCAssignmentOperator, UCContextExpression, UCBinaryOperator, UCTernaryOperator, UCArgumentedExpression, UCIndexExpression, UCParenthesisExpression, UCPredefinedContextMember, IExpression, UCLiteral, UCClassLiteral, UCNewOperator, UCPredefinedMember } from './Expressions';
import { rangeFromBounds } from './helpers';

export class UCExpressionVisitor implements UCGrammarVisitor<IExpression> {
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

	visitStatement(ctx: StatementContext): IExpression {
		const exprNode = ctx.expression();
		if (exprNode) {
			return exprNode.accept(this);
		}

		const assignNode = ctx.assignmentExpression();
		if (assignNode) {
			return assignNode.accept(this);
		}
		return undefined;
	}

	visitExpression(ctx: BinaryOperatorContext | UnaryOperatorContext | TernaryOperatorContext): IExpression {
		return ctx.accept(this);
	}

	visitTernaryOperator(ctx: TernaryOperatorContext) {
		const expression = new UCTernaryOperator();
		expression.context = ctx;

		const conditionNode = ctx.unaryExpression();
		if (conditionNode) {
			expression.condition = conditionNode.accept<IExpression>(this);
			expression.condition.outer = expression;
		}

		const leftNode = ctx.expression(0);
		if (leftNode) {
			expression.true = leftNode.accept<IExpression>(this);
			expression.true.outer = expression;
		}

		const rightNode = ctx.expression(1);
		if (rightNode) {
			expression.false = rightNode.accept<IExpression>(this);
			expression.false.outer = expression;
		}

		return expression;
	}

	visitBinaryOperator(ctx: BinaryOperatorContext) {
		const expression = new UCBinaryOperator();
		expression.context = ctx;

		const leftNode = ctx.expression(0);
		if (leftNode) {
			expression.left = leftNode.accept<IExpression>(this);
			expression.left.outer = expression;
		}

		const rightNode = ctx.expression(1);
		if (rightNode) {
			expression.right = rightNode.accept<IExpression>(this);
			expression.right.outer = expression;
		}

		return expression;
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext): UCAssignmentOperator {
		const expression = new UCAssignmentOperator();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept(this);
			expression.left.outer = expression;
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.right = exprNode.accept(this);
			expression.right.outer = expression;
		}
		return expression;
	}

	visitUnaryOperator(ctx: UnaryOperatorContext): UCUnaryOperator {
		return ctx.unaryExpression().accept(this);
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCUnaryOperator {
		throw 'This should never be called!';
	}

	visitPreOperator(ctx: PreOperatorContext) {
		const expression = new UCUnaryOperator();
		expression.context = ctx;
		expression.expression = ctx.primaryExpression().accept(this);
		expression.expression.outer = expression;
		expression.operator = ctx.operator().accept(this);
		expression.operator.outer = expression;
		return expression;
	}

	visitPostOperator(ctx: PreOperatorContext) {
		const expression = new UCUnaryOperator();
		expression.context = ctx;
		expression.expression = ctx.primaryExpression().accept(this);
		expression.expression.outer = expression;
		expression.operator = ctx.operator().accept(this);
		expression.operator.outer = expression;
		return expression;
	}

	visitPrimaryOperator(ctx: PrimaryOperatorContext): IExpression {
		return ctx.primaryExpression().accept(this);
	}

	visitParenthesisExpression(ctx: ParenthesisExpressionContext) {
		const expression = new UCParenthesisExpression();
		expression.context = ctx;
		expression.expression = ctx.expression().accept(this);
		expression.expression.outer = expression;
		return expression;
	}

	visitContextExpression(ctx: ContextExpressionContext) {
		const expression = new UCContextExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept<IExpression>(this);
			expression.left.outer = expression;
		}

		const idNode = (ctx.identifier() || ctx.classLiteralSpecifier()) as ParserRuleContext;
		if (idNode) {
			expression.member = idNode.accept(this);
			expression.member.outer = expression;
		}
		return expression;
	}

	visitMemberExpression(ctx: MemberExpressionContext) {
		return ctx.identifier().accept(this);
	}

	visitArgumentedExpression(ctx: ArgumentedExpressionContext) {
		const expression = new UCArgumentedExpression();
		expression.context = ctx;

		// expr ( arguments )
		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this) as IExpression[];
		}
		return expression;
	}

	// primaryExpression [ expression ]
	visitIndexExpression(ctx: IndexExpressionContext) {
		const expression = new UCIndexExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.primary = primaryNode.accept(this);
			expression.primary.outer = expression;
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression.outer = expression;
		}
		return expression;
	}

	// new ( arguments ) classArgument
	visitNewExpression(ctx: NewExpressionContext) {
		const expression = new UCNewOperator();
		expression.context = ctx;

		const exprNode = ctx.classArgument();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = exprArgumentNodes.accept(this) as IExpression[];
		}
		return expression;
	}

	visitClassArgument(ctx: ClassArgumentContext) {
		return ctx.primaryExpression().accept(this);
	}

	// FIXME:
	visitClassCastExpression(ctx: ClassCastExpressionContext) {
		return ctx.primaryExpression().accept(this);
	}

	// FIXME:
	visitLiteralExpression(ctx: LiteralExpressionContext) {
		const classLiteralNode = ctx.literal().classLiteral();
		if (classLiteralNode) {
			const range = rangeFromBounds(ctx.start, ctx.stop);
			const expression = new UCClassLiteral(range);

			const classIdNode = classLiteralNode.identifier();
			const classCastingRef = new UCSymbolReference(classIdNode.text, rangeFromBounds(classIdNode.start, classIdNode.stop));

			const objectIdNode = classLiteralNode.objectLiteral();
			const objectRef = new UCSymbolReference(objectIdNode.text.replace(/'/g, ""), rangeFromBounds(objectIdNode.start, objectIdNode.stop));

			expression.classCastingRef = classCastingRef;
			expression.objectRef = objectRef;
			expression.context = classLiteralNode;
			return expression;
		}

		const expression = new UCLiteral();
		expression.context = ctx;
		return expression;
	}

	visitSpecifierExpression(ctx: SpecifierExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCPredefinedMember(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCPredefinedContextMember(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitIdentifier(ctx: ParserRuleContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCMemberExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitOperator(ctx: OperatorContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCMemberExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitArguments(ctx: ArgumentsContext): IExpression {
		const argumentNodes = ctx.expression();
		if (!argumentNodes) {
			return undefined;
		}

		const expressions: IExpression[] = [];
		for (let arg of argumentNodes) {
			expressions.push(arg.accept(this));
		}
		return expressions as any as IExpression;
	}
}