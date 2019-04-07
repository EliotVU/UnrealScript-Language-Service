import { ParserRuleContext } from 'antlr4ts';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { UnaryExpressionContext, OperatorIdContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext, ArgumentsContext, BinaryOperatorContext, UnaryOperatorContext, PrimaryOperatorContext, TernaryOperatorContext, ContextExpressionContext, MemberExpressionContext, ArgumentedExpressionContext, IndexExpressionContext, GroupExpressionContext, NewExpressionContext, ClassCastExpressionContext, SpecifierExpressionContext, LiteralExpressionContext } from '../antlr/UCGrammarParser';

import { UCSymbolReference } from './Symbols';
import { UCMemberExpression, UCUnaryExpression, UCAssignmentExpression, UCContextExpression, UCBinaryExpression, UCTernaryExpression, UCArgumentedExpression, UCIndexExpression, UCGroupExpression, UCPredefinedMemberExpression, IExpression, UCLiteral, UCClassLiteral } from './Symbols/Expressions';
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
		const expression = new UCTernaryExpression();
		expression.context = ctx;

		const conditionNode = ctx.expression(0);
		if (conditionNode) {
			expression.condition = conditionNode.accept<IExpression>(this);
			expression.condition.outer = expression;
		}

		const leftNode = ctx.expression(1);
		if (leftNode) {
			expression.true = leftNode.accept<IExpression>(this);
			expression.true.outer = expression;
		}

		const rightNode = ctx.expression(2);
		if (rightNode) {
			expression.false = rightNode.accept<IExpression>(this);
			expression.false.outer = expression;
		}

		return expression;
	}

	visitBinaryOperator(ctx: BinaryOperatorContext) {
		const expression = new UCBinaryExpression();
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

	visitAssignmentExpression(ctx: AssignmentExpressionContext): UCAssignmentExpression {
		const expression = new UCAssignmentExpression();
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

	visitUnaryOperator(ctx: UnaryOperatorContext): UCUnaryExpression {
		return ctx.unaryExpression().accept(this);
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCUnaryExpression {
		const expression = new UCUnaryExpression();
		expression.context = ctx;
		expression.expression = ctx.primaryExpression().accept(this);
		expression.expression.outer = expression;
		expression.operatorId = ctx.operatorId().accept(this);
		expression.operatorId.outer = expression;
		return expression;
	}

	visitPrimaryOperator(ctx: PrimaryOperatorContext): IExpression {
		return ctx.primaryExpression().accept(this);
	}

	visitGroupExpression(ctx: GroupExpressionContext) {
		const expression = new UCGroupExpression();
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

	// FIXME:
	visitNewExpression(ctx: NewExpressionContext) {
		return ctx.classArgument().primaryExpression().accept(this);
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
		const expression = new UCMemberExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCPredefinedMemberExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitIdentifier(ctx: ParserRuleContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCMemberExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitOperatorId(ctx: OperatorIdContext): UCMemberExpression {
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