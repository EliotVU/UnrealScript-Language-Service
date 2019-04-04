import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds } from './helpers';
import { ExpressionVisitor } from './DocumentListener';

import { StatementContext, IfStatementContext, CodeBlockOptionalContext, ReplicationStatementContext, WhileStatementContext, ExpressionContext, AssignmentExpressionContext, ControlStatementContext, ReturnStatementContext, GotoStatementContext, ElseStatementContext, DoStatementContext, SwitchStatementContext, SwitchCaseContext, ForStatementContext, ForeachStatementContext, LabeledStatementContext, BinaryOperatorContext, UnaryOperatorContext, TernaryOperatorContext } from '../antlr/UCGrammarParser';
import { UCExpressionStatement, UCIfStatement, UCScriptBlock, UCElseStatement, UCDoStatement, UCWhileStatement, UCSwitchStatement, UCSwitchCase, UCForStatement, UCForEachStatement, UCLabeledStatement, IStatement, UCBlockStatement, UCReturnStatement, UCGotoStatement } from './symbols/Statements';
import { IExpression } from './symbols/Expressions';

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

	visitExpression(ctx: ExpressionContext) {
		return ctx.accept(ExpressionVisitor);
	}

	assignmentExpression(ctx: AssignmentExpressionContext) {
		return ctx.accept(ExpressionVisitor);
	}

	visitStatement(ctx: StatementContext): IStatement {
		let statementNode = ctx.ifStatement()
			|| ctx.whileStatement() || ctx.switchStatement()
			|| ctx.labeledStatement() || ctx.forStatement()
			|| ctx.foreachStatement() || ctx.doStatement()
			|| ctx.controlStatement();
		if (statementNode) {
			return statementNode.accept(this);
		}

		const exprNode = (ctx.expression() as BinaryOperatorContext | UnaryOperatorContext | TernaryOperatorContext)
			|| ctx.assignmentExpression();
		if (!exprNode) {
			return undefined;
		}

		const expression: IExpression = exprNode.accept(ExpressionVisitor);
		if (expression) {
			const satement = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
			satement.context = ctx;
			satement.expression = expression;
			return satement;
		}
	}

	visitLabeledStatement(ctx: LabeledStatementContext): UCLabeledStatement {
		const statement = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
		const nameNode = ctx.labelName();
		if (nameNode) {
			statement.label = nameNode.text;
		}
		statement.context = ctx;
		return statement;
	}

	visitControlStatement(ctx: ControlStatementContext): IStatement {
		let statementNode = ctx.returnStatement() || ctx.gotoStatement();
		if (statementNode) {
			return statementNode.accept(this);
		}
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
		const statemment = new UCSwitchStatement(rangeFromBounds(ctx.start, ctx.stop));
		statemment.context = ctx;

		const exprNode = ctx.expression();
		if (exprNode) {
			statemment.expression = exprNode.accept(ExpressionVisitor);
		}

		const caseStatementNodes = ctx.switchCase();
		if (caseStatementNodes) {
			const scriptBlock = new UCScriptBlock(rangeFromBounds(ctx.start, ctx.stop));
			scriptBlock.statements = Array(caseStatementNodes.length);
			for (var i = 0; i < caseStatementNodes.length; ++ i) {
				const caseStatement = caseStatementNodes[i].accept(this);
				scriptBlock.statements[i] = caseStatement;
			}
			statemment.scriptBlock = scriptBlock;
		}
		return statemment;
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