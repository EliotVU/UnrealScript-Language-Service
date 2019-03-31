import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds } from './helpers';
import { ExpressionVisitor } from './DocumentListener';

import { StatementContext, IfStatementContext, CodeBlockOptionalContext, ReplicationStatementContext, WhileStatementContext, ExpressionContext, AssignmentExpressionContext, ControlStatementContext, ReturnStatementContext, GotoStatementContext, ElseStatementContext, DoStatementContext, SwitchStatementContext, SwitchCaseContext, ForStatementContext, ForeachStatementContext, LabeledStatementContext, BinaryOperatorContext, UnaryOperatorContext, TernaryOperatorContext } from '../antlr/UCGrammarParser';
import { UCStatement, UCExpressionStatement, UCIfStatement, UCScriptBlock, UCElseStatement, UCDoStatement, UCWhileStatement, UCSwitchStatement, UCSwitchCase, UCForStatement, UCForEachStatement, UCLabeledStatement } from './symbols/Statements';
import { UCExpression } from './symbols/Expressions';

export class UCStatementVisitor implements UCGrammarVisitor<UCStatement> {
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

	visitStatement(ctx: StatementContext): UCStatement {
		let sm = ctx.ifStatement()
			|| ctx.whileStatement() || ctx.switchStatement()
			|| ctx.labeledStatement() || ctx.forStatement()
			|| ctx.foreachStatement() || ctx.doStatement()
			|| ctx.controlStatement();
		if (sm) {
			return sm.accept(this);
		}

		const expr = (ctx.expression() as BinaryOperatorContext | UnaryOperatorContext | TernaryOperatorContext)
			|| ctx.assignmentExpression();
		if (!expr) {
			return undefined;
		}

		const exprSymbol: UCExpression = expr.accept(ExpressionVisitor);
		if (exprSymbol) {
			const smSymbol = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
			smSymbol.context = ctx;
			smSymbol.expression = exprSymbol;
			return smSymbol;
		}
	}

	visitLabeledStatement(ctx: LabeledStatementContext): UCLabeledStatement {
		const name = ctx.labelName();
		const smSymbol = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;
		return smSymbol;
	}

	visitControlStatement(ctx: ControlStatementContext): UCStatement {
		let sm = ctx.returnStatement() || ctx.gotoStatement();
		if (sm) {
			return sm.accept(this);
		}
	}

	visitReturnStatement(ctx: ReturnStatementContext): UCExpressionStatement {
		// TODO: custom class
		const smSymbol = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}
		return smSymbol;
	}

	visitGotoStatement(ctx: GotoStatementContext) {
		// TODO: custom class
		const smSymbol = new UCExpressionStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;
		// TODO: read label
		return smSymbol;
	}

	visitReplicationStatement(ctx: ReplicationStatementContext): UCIfStatement {
		// TODO:
		return undefined;
	}

	visitWhileStatement(ctx: WhileStatementContext): UCWhileStatement {
		const smSymbol = new UCWhileStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);
		}
		return smSymbol;
	}

	visitIfStatement(ctx: IfStatementContext): UCIfStatement {
		const smSymbol = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);
		}

		const elseSm = ctx.elseStatement();
		if (elseSm) {
			smSymbol.elseStatement = elseSm.accept(this);
		}
		return smSymbol;
	}

	visitElseStatement(ctx: ElseStatementContext): UCElseStatement {
		const smSymbol = new UCElseStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);

		}
		return smSymbol;
	}

	visitDoStatement(ctx: DoStatementContext): UCDoStatement {
		const smSymbol = new UCDoStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);
		}
		return smSymbol;
	}

	visitSwitchStatement(ctx: SwitchStatementContext) {
		const smSymbol = new UCSwitchStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		const cases = ctx.switchCase();
		if (cases) {
			const blockSymbol = new UCScriptBlock(rangeFromBounds(ctx.start, ctx.stop));
			for (let sm of cases) {
				const subSmSymbol = sm.accept(this);
				if (subSmSymbol) {
					blockSymbol.statements.push(subSmSymbol);
				}
			}
			return blockSymbol;
		}
		return smSymbol;
	}

	visitForeachStatement(ctx: ForeachStatementContext): UCForEachStatement {
		const smSymbol = new UCForEachStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.primaryExpression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);
		}
		return smSymbol;
	}

	visitForStatement(ctx: ForStatementContext): UCForStatement {
		const smSymbol = new UCForStatement(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		let expr = ctx.expression(0);
		if (expr) {
			smSymbol.initExpression = expr.accept(ExpressionVisitor);
		}

		expr = ctx.expression(1);
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}

		expr = ctx.expression(2);
		if (expr) {
			smSymbol.nextExpression = expr.accept(ExpressionVisitor);
		}

		const block = ctx.codeBlockOptional();
		if (block) {
			smSymbol.scriptBlock = this.parseScriptBlock(block);
		}
		return smSymbol;
	}

	visitSwitchCase(ctx: SwitchCaseContext) {
		const smSymbol = new UCSwitchCase(rangeFromBounds(ctx.start, ctx.stop));
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}
		smSymbol.scriptBlock = this.parseScriptBlock(ctx);

		const breakStatement = ctx.breakStatement();
		if (breakStatement) {
			const breakSm = breakStatement.accept(this);
			if (breakSm) {
				if (!smSymbol.scriptBlock) {
					smSymbol.scriptBlock = new UCScriptBlock(rangeFromBounds(breakStatement.start, breakStatement.stop));
				}
				smSymbol.scriptBlock.statements.push(breakSm);
			}
		}
		return smSymbol;
	}

	parseScriptBlock(ctx: CodeBlockOptionalContext|SwitchCaseContext) {
		const statements = ctx.statement();
		if (statements) {
			const blockSymbol = new UCScriptBlock(rangeFromBounds(ctx.start, ctx.stop));

			for (let sm of statements) {
				const subSmSymbol = sm.accept(this);
				if (subSmSymbol) {
					blockSymbol.statements.push(subSmSymbol);
				}
			}
			return blockSymbol;
		}
		return undefined;
	}
}