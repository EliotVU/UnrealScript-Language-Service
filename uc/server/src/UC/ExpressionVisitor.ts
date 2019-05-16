import { ParserRuleContext } from 'antlr4ts';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { OperatorContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext, ArgumentsContext, ConditionalExpressionContext, PropertyAccessExpressionContext, MemberExpressionContext, CallExpressionContext, ElementAccessExpressionContext, NewExpressionContext, SpecifierExpressionContext, LiteralExpressionContext, ParenthesizedExpressionContext, MetaClassExpressionContext, VectTokenContext, RotTokenContext, RngTokenContext, ClassLiteralContext, LiteralContext, ArrayCountExpressionContext, SuperExpressionContext, BinaryExpressionContext, UnaryOperatorContext, UnaryExpressionContext, ExpressionContext } from '../antlr/UCGrammarParser';

import { UCSymbolReference, UCTypeSymbol } from './Symbols';
import { UCMemberExpression, UCUnaryExpression, UCAssignmentExpression, UCPropertyAccessExpression, UCBinaryExpression, UCConditionalExpression, UCCallExpression, UCElementAccessExpression, UCParenthesizedExpression, UCPredefinedPropertyAccessExpression, IExpression, UCLiteral, UCClassLiteral, UCNewExpression, UCPredefinedAccessExpression, UCVectLiteral, UCRotLiteral, UCRngLiteral, UCMetaClassExpression, UCSuperExpression } from './Expressions';
import { rangeFromBounds, rangeFromBound } from './helpers';
import { UCTypeKind } from './Symbols/TypeKind';

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
		return undefined;
	}

	visitExpression(ctx: ExpressionContext): IExpression {
		return ctx.childCount === 1 && ctx.getChild(0).accept(this);
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext) {
		const expression = new UCAssignmentExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept<IExpression>(this);
			expression.left.outer = expression;
		}

		const operatorNode = ctx.assignmentOperator();
		expression.operator = new UCSymbolReference(operatorNode.text, rangeFromBounds(operatorNode.start, operatorNode.stop));

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.right = exprNode.accept<IExpression>(this);
			expression.right.outer = expression;
		}
		return expression;
	}

	visitConditionalExpression(ctx: ConditionalExpressionContext) {
		const expression = new UCConditionalExpression();
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

	visitBinaryExpression(ctx: BinaryExpressionContext) {
		const expression = new UCBinaryExpression();
		expression.context = ctx;

		const leftNode = ctx.unaryExpression();
		if (leftNode) {
			expression.left = leftNode.accept<IExpression>(this);
			expression.left.outer = expression;
		}

		const operatorNode = ctx.functionName();
		expression.operator = new UCSymbolReference(operatorNode.text, rangeFromBounds(operatorNode.start, operatorNode.stop));

		const rightNode = ctx.expression();
		if (rightNode) {
			expression.right = rightNode.accept<IExpression>(this);
			expression.right.outer = expression;
		}
		return expression;
	}

	visitUnaryExpression(ctx: UnaryExpressionContext): UCUnaryExpression {
		const primaryNode = ctx.primaryExpression();
		const operatorNode = ctx.unaryOperator();
		if (operatorNode) {
			const expression = new UCUnaryExpression();
			expression.context = ctx;
			expression.expression = primaryNode.accept(this);
			expression.expression.outer = expression;
			expression.operator = new UCSymbolReference(operatorNode.text, rangeFromBounds(operatorNode.start, operatorNode.stop));
			return expression;
		}
		return primaryNode.accept(this);
	}

	visitParenthesizedExpression(ctx: ParenthesizedExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;
		expression.expression = ctx.expression().accept(this);
		expression.expression.outer = expression;
		return expression;
	}

	visitPropertyAccessExpression(ctx: PropertyAccessExpressionContext) {
		const expression = new UCPropertyAccessExpression();
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

	visitCallExpression(ctx: CallExpressionContext) {
		const expression = new UCCallExpression();
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
	visitElementAccessExpression(ctx: ElementAccessExpressionContext) {
		const expression = new UCElementAccessExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.expression = primaryNode.accept(this);
			expression.expression.outer = expression;
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.argument = exprNode.accept(this);
			expression.argument.outer = expression;
		}
		return expression;
	}

	// new ( arguments ) classArgument
	visitNewExpression(ctx: NewExpressionContext) {
		const expression = new UCNewExpression();
		expression.context = ctx;

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

	visitMetaClassExpression(ctx: MetaClassExpressionContext) {
		const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		expression.classRef = new UCTypeSymbol(classIdNode.text, rangeFromBounds(classIdNode.start, classIdNode.stop), undefined, UCTypeKind.Class);

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression.outer = expression;
		}
		return expression;
	}

	visitSuperExpression(ctx: SuperExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSuperExpression(range);
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCTypeSymbol(classIdNode.text, rangeFromBounds(classIdNode.start, classIdNode.stop), undefined, UCTypeKind.Class);
		}
		return expression;
	}

	visitSpecifierExpression(ctx: SpecifierExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(ctx.text, range));
		expression.context = ctx;
		return expression;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCPredefinedPropertyAccessExpression(new UCSymbolReference(ctx.text, range));
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

	visitUnaryOperator(ctx: UnaryOperatorContext): UCMemberExpression {
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

	// TODO: Implement specialized symbol class.
	visitArrayCountExpression(ctx: ArrayCountExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;
		expression.expression = ctx.primaryExpression().accept(this);
		expression.expression.outer = expression;
		return expression;
	}

	visitLiteralExpression(ctx: LiteralExpressionContext): IExpression {
		return ctx.literal().accept<IExpression>(this);
	}

	visitLiteral(ctx: LiteralContext): IExpression {
		const literal = ctx.getChild(0).accept<IExpression>(this);
		// TODO: Deprecate as soon as all literals are supported!
		if (!literal) {
			const expression = new UCLiteral(rangeFromBounds(ctx.start, ctx.stop));
			expression.context = ctx;
			return expression;
		}
		return literal;
	}

	visitClassLiteral(ctx: ClassLiteralContext) {
		const classIdNode = ctx.identifier();
		const classCastingRef = new UCSymbolReference(classIdNode.text, rangeFromBounds(classIdNode.start, classIdNode.stop));

		const objectIdNode = ctx.NAME();
		const objectRef = new UCSymbolReference(objectIdNode.text.replace(/'|\s/g, ""), rangeFromBound(objectIdNode.symbol));

		const expression = new UCClassLiteral(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;
		expression.classCastingRef = classCastingRef;
		expression.objectRef = objectRef;
		return expression;
	}

	visitVectToken(ctx: VectTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCVectLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitRotToken(ctx: RotTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRotLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitRngToken(ctx: RngTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCRngLiteral(range);
		expression.context = ctx;
		return expression;
	}
}