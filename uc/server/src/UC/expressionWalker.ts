import { ParserRuleContext } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { RuleNode } from 'antlr4ts/tree/RuleNode';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';
import { OperatorContext, AssignmentExpressionContext, StatementContext, ClassLiteralSpecifierContext, ArgumentsContext, ConditionalExpressionContext, PropertyAccessExpressionContext, MemberExpressionContext, CallExpressionContext, ElementAccessExpressionContext, NewExpressionContext, SpecifierExpressionContext, LiteralExpressionContext, ParenthesizedExpressionContext, MetaClassExpressionContext, VectTokenContext, RotTokenContext, RngTokenContext, ObjectLiteralContext, LiteralContext, ArrayCountExpressionContext, SuperExpressionContext, BinaryExpressionContext, UnaryOperatorContext, UnaryExpressionContext, ExpressionContext, StringLiteralContext, NameLiteralContext, BoolLiteralContext, NumberLiteralContext, NoneLiteralContext, NameOfTokenContext, IntLiteralContext } from '../antlr/UCGrammarParser';

import { UCSymbolReference, UCTypeSymbol, UCTypeKind, Identifier } from './Symbols';
import {
	UCMemberExpression,
	UCUnaryExpression,
	UCAssignmentExpression,
	UCPropertyAccessExpression,
	UCBinaryExpression,
	UCConditionalExpression,
	UCCallExpression,
	UCElementAccessExpression,
	UCParenthesizedExpression,
	UCPredefinedPropertyAccessExpression,
	IExpression,
	UCObjectLiteral,
	UCNewExpression,
	UCPredefinedAccessExpression,
	UCVectLiteral,
	UCRotLiteral,
	UCRngLiteral,
	UCMetaClassExpression,
	UCSuperExpression,
	UCStringLiteral,
	UCNameLiteral,
	UCBoolLiteral,
	UCFloatLiteral,
	UCNoneLiteral,
	UCNameOfLiteral,
	UCIntLiteral
} from './expressions';
import { rangeFromBounds, rangeFromBound } from './helpers';
import { createIdentifierFrom } from './documentASTWalker';

export class ExpressionWalker implements UCGrammarVisitor<IExpression> {
	visit(tree: ParseTree): IExpression {
		return undefined!;
	}

	visitChildren(node: RuleNode): IExpression {
		return undefined!;
	}

	visitTerminal(node: TerminalNode): IExpression {
		return undefined!;
	}

	visitErrorNode(node: ErrorNode): IExpression {
		return undefined!;
	}

	visitStatement(ctx: StatementContext): IExpression {
		const exprNode = ctx.expression();
		if (exprNode) {
			return exprNode.accept(this);
		}
		return undefined!;
	}

	visitExpression(ctx: ExpressionContext) {
		return ctx.getChild(0).accept(this);
	}

	visitAssignmentExpression(ctx: AssignmentExpressionContext) {
		const expression = new UCAssignmentExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept<IExpression>(this);
			expression.left!.outer = expression;
		}

		const operatorNode = ctx.assignmentOperator();
		expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.right = exprNode.accept<IExpression>(this);
			expression.right!.outer = expression;
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
			expression.true!.outer = expression;
		}

		const rightNode = ctx.expression(1);
		if (rightNode) {
			expression.false = rightNode.accept<IExpression>(this);
			expression.false!.outer = expression;
		}
		return expression;
	}

	visitBinaryExpression(ctx: BinaryExpressionContext) {
		const expression = new UCBinaryExpression();
		expression.context = ctx;

		const leftNode = ctx.unaryExpression();
		if (leftNode) {
			expression.left = leftNode.accept<IExpression>(this);
			expression.left!.outer = expression;
		}

		const operatorNode = ctx.functionName();
		expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));

		const rightNode = ctx.expression();
		if (rightNode) {
			expression.right = rightNode.accept<IExpression>(this);
			expression.right!.outer = expression;
		}
		return expression;
	}

	visitUnaryExpression(ctx: UnaryExpressionContext) {
		const primaryNode = ctx.primaryExpression();
		const operatorNode = ctx.unaryOperator();
		if (operatorNode) {
			const expression = new UCUnaryExpression();
			expression.context = ctx;
			expression.expression = primaryNode.accept<IExpression>(this);
			expression.expression.outer = expression;
			expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
			return expression;
		}
		return primaryNode.accept<IExpression>(this);
	}

	visitParenthesizedExpression(ctx: ParenthesizedExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept<IExpression>(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitPropertyAccessExpression(ctx: PropertyAccessExpressionContext) {
		const expression = new UCPropertyAccessExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.left = primaryNode.accept<IExpression>(this);
			expression.left!.outer = expression;
		}

		const idNode = ctx.identifier();
		if (idNode) {
			expression.member = idNode.accept(this);
			expression.member!.outer = expression;
			return expression;
		}

		const specNode = ctx.classLiteralSpecifier();
		if (specNode) {
			expression.member = specNode.accept(this);
			expression.member!.outer = expression;
			return expression;
		}

		throw "PropertyAccess with no member!";
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
			expression.expression!.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = this.visitExpressionArguments(exprArgumentNodes);
		}
		return expression;
	}

	// primaryExpression [ expression ]
	visitElementAccessExpression(ctx: ElementAccessExpressionContext) {
		const expression = new UCElementAccessExpression();
		expression.context = ctx;

		const primaryNode = ctx.primaryExpression();
		if (primaryNode) {
			expression.expression = primaryNode.accept<IExpression>(this);
			expression.expression!.outer = expression;
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.argument = exprNode.accept<IExpression>(this);
			expression.argument!.outer = expression;
		}
		return expression;
	}

	// new ( arguments ) classArgument
	visitNewExpression(ctx: NewExpressionContext) {
		const expression = new UCNewExpression();
		expression.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<IExpression | undefined>(this);
			expression.expression!.outer = expression;
		}

		const exprArgumentNodes = ctx.arguments();
		if (exprArgumentNodes) {
			expression.arguments = this.visitExpressionArguments(exprArgumentNodes);
		}
		return expression;
	}

	visitMetaClassExpression(ctx: MetaClassExpressionContext) {
		const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
		}

		const exprNode = ctx.expression();
		if (exprNode) {
			expression.expression = exprNode.accept(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitSuperExpression(ctx: SuperExpressionContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCSuperExpression(range);
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		if (classIdNode) {
			expression.classRef = new UCTypeSymbol(createIdentifierFrom(classIdNode), undefined, UCTypeKind.Class);
		}
		return expression;
	}

	visitSpecifierExpression(ctx: SpecifierExpressionContext) {
		const expression = new UCPredefinedAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitClassLiteralSpecifier(ctx: ClassLiteralSpecifierContext) {
		const expression = new UCPredefinedPropertyAccessExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitIdentifier(ctx: ParserRuleContext): UCMemberExpression {
		const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitOperator(ctx: OperatorContext): UCMemberExpression {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitUnaryOperator(ctx: UnaryOperatorContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCMemberExpression(new UCSymbolReference(createIdentifierFrom(ctx)));
		expression.context = ctx;
		return expression;
	}

	visitExpressionArguments(ctx: ArgumentsContext): IExpression[] | undefined {
		const argumentNodes = ctx.expression();
		if (!argumentNodes) {
			return undefined;
		}

		const expressions: IExpression[] = [];
		for (let arg of argumentNodes) {
			expressions.push(arg.accept(this));
		}
		return expressions;
	}

	// TODO: Implement specialized symbol class.
	visitArrayCountExpression(ctx: ArrayCountExpressionContext) {
		const expression = new UCParenthesizedExpression();
		expression.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			expression.expression = exprNode.accept<IExpression>(this);
			expression.expression!.outer = expression;
		}
		return expression;
	}

	visitLiteralExpression(ctx: LiteralExpressionContext) {
		return ctx.literal().accept<IExpression>(this);
	}

	visitLiteral(ctx: LiteralContext): IExpression {
		const literal = ctx.getChild(0).accept<IExpression>(this);
		return literal;
	}

	visitNoneLiteral(ctx: NoneLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNoneLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitStringLiteral(ctx: StringLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCStringLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitNameLiteral(ctx: NameLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNameLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitBoolLiteral(ctx: BoolLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCBoolLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitFloatLiteral(ctx: NumberLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCFloatLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitIntLiteral(ctx: IntLiteralContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCIntLiteral(range);
		expression.context = ctx;
		return expression;
	}

	visitObjectLiteral(ctx: ObjectLiteralContext) {
		const expression = new UCObjectLiteral(rangeFromBounds(ctx.start, ctx.stop));
		expression.context = ctx;

		const classIdNode = ctx.identifier();
		const castRef = new UCSymbolReference(createIdentifierFrom(classIdNode));
		expression.castRef = castRef;

		const objectIdNode = ctx.NAME();
		const objectIdentifier: Identifier = {
			name: objectIdNode.text.replace(/'|\s/g, ""),
			range: rangeFromBound(objectIdNode.symbol)
		};
		const objectRef = new UCSymbolReference(objectIdentifier);
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

	visitNameOfToken(ctx: NameOfTokenContext) {
		const range = rangeFromBounds(ctx.start, ctx.stop);
		const expression = new UCNameOfLiteral(range);
		expression.context = ctx;
		const idNode = ctx.identifier();
		if (idNode) {
			expression.memberRef = new UCSymbolReference(createIdentifierFrom(idNode));
		}
		return expression;
	}
}

export const ExpressionVisitor = new ExpressionWalker();