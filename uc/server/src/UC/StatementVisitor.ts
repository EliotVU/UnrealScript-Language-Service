import { UCGrammarVisitor } from '../antlr/UCGrammarVisitor';

import { rangeFromBounds } from './helpers';
import { ExpressionVisitor } from './DocumentListener';

import { StatementContext, IfStatementContext, CodeBlockOptionalContext, ReplicationStatementContext, WhileStatementContext, ExpressionContext, AssignmentExpressionContext, ControlStatementContext, ReturnStatementContext, GotoStatementContext } from '../antlr/UCGrammarParser';
import { UCStatement, UCExpressionStatement, UCIfStatement, UCScriptBlock } from './symbols/Statements';
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

		const expr = ctx.expression() || ctx.assignmentExpression();
		if (!expr) {
			return undefined;
		}

		const exprSymbol: UCExpression = expr.accept(ExpressionVisitor);
		if (exprSymbol) {
			const smSymbol = new UCExpressionStatement({
				name: '', range: rangeFromBounds(ctx.start, ctx.stop)
			});
			smSymbol.context = ctx;
			smSymbol.expression = exprSymbol;
			return smSymbol;
		}
	}

	visitControlStatement(ctx: ControlStatementContext): UCStatement {
		let sm = ctx.returnStatement() || ctx.gotoStatement();
		if (sm) {
			return sm.accept(this);
		}
	}

	visitReturnStatement(ctx: ReturnStatementContext): UCExpressionStatement {
		// TODO: custom class
		const smSymbol = new UCExpressionStatement({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		smSymbol.context = ctx;

		const expr = ctx.expression();
		if (expr) {
			smSymbol.expression = expr.accept(ExpressionVisitor);
		}
		return smSymbol;
	}

	visitGotoStatement(ctx: GotoStatementContext) {
		// TODO: custom class
		const smSymbol = new UCExpressionStatement({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
		smSymbol.context = ctx;
		// TODO: read label
		return smSymbol;
	}

	visitReplicationStatement(ctx: ReplicationStatementContext): UCIfStatement {
		// TODO:
		return undefined;
	}

	visitWhileStatement(ctx: WhileStatementContext): UCIfStatement {
		// TODO: custom class
		return this.visitIfStatement(ctx as any as IfStatementContext);
	}

	visitIfStatement(ctx: IfStatementContext): UCIfStatement {
		const smSymbol = new UCIfStatement({
			name: '', range: rangeFromBounds(ctx.start, ctx.stop)
		});
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

	parseScriptBlock(ctx: CodeBlockOptionalContext) {
		const statements = ctx.statement();
		if (statements) {
			const blockSymbol = new UCScriptBlock(
				{ name: '', range: rangeFromBounds(ctx.start, ctx.stop) }
			);

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