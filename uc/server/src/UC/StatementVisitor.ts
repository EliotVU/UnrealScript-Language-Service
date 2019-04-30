import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds } from './helpers';
import { ExpressionVisitor } from './DocumentListener';

import { UCScriptBlock } from "./ScriptBlock";

import { StatementContext, IfStatementContext, CodeBlockOptionalContext, ReplicationStatementContext, WhileStatementContext, ReturnStatementContext, GotoStatementContext, ElseStatementContext, DoStatementContext, SwitchStatementContext, SwitchCaseContext, ForStatementContext, ForeachStatementContext, LabeledStatementContext } from '../antlr/UCGrammarParser';
import { UCExpressionStatement, UCIfStatement, UCElseStatement, UCDoStatement, UCWhileStatement, UCSwitchStatement, UCSwitchCase, UCForStatement, UCForEachStatement, UCLabeledStatement, IStatement, UCReturnStatement, UCGotoStatement } from './Statements';
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
		let statementNode = ctx.ifStatement()
			|| ctx.whileStatement() || ctx.switchStatement()
			|| ctx.labeledStatement() || ctx.forStatement()
			|| ctx.foreachStatement() || ctx.doStatement()
			|| ctx.continueStatement() || ctx.breakStatement() || ctx.stopStatement()
			|| ctx.returnStatement() || ctx.gotoStatement();
		if (statementNode) {
			return statementNode.accept(this);
		}

		const exprNode = ctx.expression() || ctx.assignmentExpression() as ParserRuleContext;
		if (exprNode) {
			const statement = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
			statement.context = exprNode;
			statement.expression = exprNode.accept(ExpressionVisitor);
			return statement;
		}

		throw 'Not implemented!';
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
			statement.scriptBlock = this.parseScriptBlock(blockNode);
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
			statement.scriptBlock = this.parseScriptBlock(blockNode);
		}

		const elseStatementNode = ctx.elseStatement();
		if (elseStatementNode) {
			statement.else = elseStatementNode.accept(this);
		}
		return statement;
	}

	visitElseStatement(ctx: ElseStatementContext): UCElseStatement {
		const statement = new UCElseStatement(rangeFromBounds(ctx.start, ctx.stop));
		statement.context = ctx;

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statement.scriptBlock = this.parseScriptBlock(blockNode);

		}
		return statement;
	}

	visitDoStatement(ctx: DoStatementContext): UCDoStatement {
		const statemment = new UCDoStatement(rangeFromBounds(ctx.start, ctx.stop));
		statemment.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statemment.expression = exprNode.accept(ExpressionVisitor);
		}

		const blockNode = ctx.codeBlockOptional();
		if (blockNode) {
			statemment.scriptBlock = this.parseScriptBlock(blockNode);
		}
		return statemment;
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
			const scriptBlock = new UCScriptBlock(rangeFromBounds(ctx.start, ctx.stop));
			scriptBlock.statements = Array(caseStatementNodes.length);
			for (var i = 0; i < caseStatementNodes.length; ++ i) {
				const caseStatement = caseStatementNodes[i].accept(this);
				scriptBlock.statements[i] = caseStatement;
			}
			statement.scriptBlock = scriptBlock;
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
			statement.scriptBlock = this.parseScriptBlock(blockNode);
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
			statement.scriptBlock = this.parseScriptBlock(blockNode);
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
		statement.scriptBlock = this.parseScriptBlock(ctx);

		// TODO: deprecate, merge this with general statement nodes.
		const breakStatementNode = ctx.breakStatement();
		if (breakStatementNode) {
			const breakStatement = breakStatementNode.accept(this);
			statement.break = breakStatement;
		}
		return statement;
	}

	parseScriptBlock(ctx: CodeBlockOptionalContext|SwitchCaseContext): UCScriptBlock {
		const statementNodes = ctx.statement();
		if (statementNodes) {
			const scriptBlock = new UCScriptBlock(rangeFromBounds(ctx.start, ctx.stop));
			scriptBlock.statements = new Array(statementNodes.length);
			for (var i = 0; i < statementNodes.length; ++ i) {
				const statement = statementNodes[i].accept(this);
				scriptBlock.statements[i] = statement;
			}
			return scriptBlock;
		}
		return undefined;
	}
}