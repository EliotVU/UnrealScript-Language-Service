import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds } from './helpers';
import { ExpressionVisitor } from './DocumentListener';

import { StatementContext, IfStatementContext, CodeBlockOptionalContext, ReplicationStatementContext, WhileStatementContext, ReturnStatementContext, GotoStatementContext, ElseStatementContext, DoStatementContext, SwitchStatementContext, SwitchCaseContext, ForStatementContext, ForeachStatementContext, LabeledStatementContext, AssertStatementContext } from '../antlr/UCGrammarParser';
import { UCExpressionStatement, UCIfStatement, UCDoUntilStatement, UCWhileStatement, UCSwitchStatement, UCSwitchCase, UCForStatement, UCForEachStatement, UCLabeledStatement, IStatement, UCReturnStatement, UCGotoStatement, UCAssertStatement, UCBlock } from './Statements';
import { ParserRuleContext } from 'antlr4ts';

export class UCStatementVisitor implements UCGrammarVisitor<IStatement> {
	visitTerminal(ctx) {
		return undefined;
	}

	visitErrorNode(ctx) {
		return undefined;
	}

	visit(ctx) {
		return undefined;
	}

	visitChildren(ctx) {
		return undefined;
	}

	visitStatement(ctx: StatementContext): IStatement {
		const exprNode = ctx.expression() || ctx.assignmentExpression() as ParserRuleContext;
		if (exprNode) {
			const statement = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
			statement.context = exprNode;
			statement.expression = exprNode.accept(ExpressionVisitor);
			return statement;
		}

		const statementNode = ctx.getChild(0);
		return statementNode && statementNode.accept(this);
	}

	visitLabeledStatement(ctx: LabeledStatementContext): UCLabeledStatement {
		const statement = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
		const idNode = ctx.identifier();
		if (idNode) {
			statement.label = idNode.text;
		}
		statement.context = ctx;
		return statement;
	}

	visitReturnStatement(ctx: ReturnStatementContext): IStatement {
		const statement = new UCReturnStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}
		return statement;
	}

	visitGotoStatement(ctx: GotoStatementContext): IStatement {
		const statement = new UCGotoStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;
		// TODO: read label
		return statement;
	}

	visitReplicationStatement(ctx: ReplicationStatementContext): UCIfStatement {
		const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}
		return statement;
	}

	visitWhileStatement(ctx: WhileStatementContext): UCWhileStatement {
		const statement = new UCWhileStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = blockNode.accept(this);
		}
		return statement;
	}

	visitIfStatement(ctx: IfStatementContext): UCIfStatement {
		const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = blockNode.accept(this);
		}

		const elseStatementNode = ctx.elseStatement();
		if (elseStatementNode) {
			statement.else = elseStatementNode.accept(this);
		}
		return statement;
	}

	visitElseStatement(ctx: ElseStatementContext) {
		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			return blockNode.accept(this);
		}
		return undefined;
	}

	visitDoStatement(ctx: DoStatementContext): UCDoUntilStatement {
		const statement = new UCDoUntilStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = blockNode.accept(this);
		}
		return statement;
	}

	visitSwitchStatement(ctx: SwitchStatementContext): IStatement {
		const statement = new UCSwitchStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		const caseStatementNodes = ctx.switchCase();
		if (caseStatementNodes) {
			const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
			block.statements = Array(caseStatementNodes.length);
			for (var i = 0; i < caseStatementNodes.length; ++ i) {
				const caseStatement = caseStatementNodes[i].accept(this);
				block.statements[i] = caseStatement;
			}
			statement.then = block;
		}
		return statement;
	}

	visitForeachStatement(ctx: ForeachStatementContext): UCForEachStatement {
		const statement = new UCForEachStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.primaryExpression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = blockNode.accept(this);
		}
		return statement;
	}

	visitForStatement(ctx: ForStatementContext): UCForStatement {
		const statement = new UCForStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		let exprNode = ctx.expression(0);
		if (exprNode) {
			statement.init = exprNode.accept(ExpressionVisitor);
		}

		exprNode = ctx.expression(1);
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}

		exprNode = ctx.expression(2);
		if (exprNode) {
			statement.next = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.then = blockNode.accept(this);
		}
		return statement;
	}

	visitSwitchCase(ctx: SwitchCaseContext): IStatement {
		const statement = new UCSwitchCase(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}
		statement.then = this.visitCodeBlockOptional(ctx);

		// TODO: deprecate, merge this with general statement nodes.
		const breakStatementNode = ctx.breakStatement();
		if (breakStatementNode) {
			const breakStatement = breakStatementNode.accept(this);
			statement.break = breakStatement;
		}
		return statement;
	}

	visitAssertStatement(ctx: AssertStatementContext): IStatement {
		const statement = new UCAssertStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statement.expression = exprNode.accept(ExpressionVisitor);
		}
		return statement;
	}

	visitCodeBlockOptional(ctx: CodeBlockOptionalContext|SwitchCaseContext): UCBlock {
		const block = new UCBlock(rangeFromBounds(ctx.start, ctx.stop));
		const statementNodes = ctx.statement();
		if (statementNodes) {
			block.statements = new Array(statementNodes.length);
			for (var i = 0; i < statementNodes.length; ++ i) {
				const statement = statementNodes[i].accept(this);
				block.statements[i] = statement;
			}
		}
		return block;
	}
}