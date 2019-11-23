import {
	ISymbol,
	UCClassSymbol,
	UCEnumSymbol,
	UCEnumMemberSymbol,
	UCStructSymbol,
	UCConstSymbol,
	UCPropertySymbol,
	UCLocalSymbol,
	UCParamSymbol,
	UCMethodSymbol,
	UCStateSymbol,
	UCObjectTypeSymbol,
	UCMapTypeSymbol,
	UCDelegateTypeSymbol,
	UCArrayTypeSymbol,
	UCPackage,
	UCScriptStructSymbol,
	UCReplicationBlock,
	UCDefaultPropertiesBlock,
	UCObjectSymbol,
} from './Symbols';
import {
	UCBlock, IStatement, UCExpressionStatement,
	UCLabeledStatement, UCAssertStatement, UCIfStatement,
	UCDoUntilStatement, UCWhileStatement, UCSwitchStatement,
	UCCaseClause, UCDefaultClause, UCForStatement,
	UCForEachStatement, UCReturnStatement, UCGotoStatement
} from './statements';
import { IExpression } from './expressions';

export interface SymbolWalker<T> {
	visit(symbol: ISymbol): T;
	visitPackage(symbol: UCPackage): T;
	visitObjectType(symbol: UCObjectTypeSymbol): T;
	visitMapType(symbol: UCMapTypeSymbol): T;
	visitDelegateType(symbol: UCDelegateTypeSymbol): T;
	visitArrayType(symbol: UCArrayTypeSymbol): T;
	visitClass(symbol: UCClassSymbol): T;
	visitConst(symbol: UCConstSymbol): T;
	visitEnum(symbol: UCEnumSymbol): T;
	visitEnumMember(symbol: UCEnumMemberSymbol): T;
	visitStruct(symbol: UCStructSymbol): T;
	visitScriptStruct(symbol: UCScriptStructSymbol): T;
	visitProperty(symbol: UCPropertySymbol): T;
	visitMethod(symbol: UCMethodSymbol): T;
	visitParameter(symbol: UCParamSymbol): T;
	visitLocal(symbol: UCLocalSymbol): T;
	visitState(symbol: UCStateSymbol): T;
	visitBlock(symbol: UCBlock): T;
	visitReplicationBlock(symbol: UCReplicationBlock): T;
	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): T;
	visitObjectSymbol(symbol: UCObjectSymbol): T;
	visitExpressionStatement(stm: UCExpressionStatement): T;
	visitLabeledStatement(stm: UCLabeledStatement): T;
	visitAssertStatement(stm: UCAssertStatement): T;
	visitIfStatement(stm: UCIfStatement): T;
	visitDoUntilStatement(stm: UCDoUntilStatement): T;
	visitWhileStatement(stm: UCWhileStatement): T;
	visitSwitchStatement(stm: UCSwitchStatement): T;
	visitCaseClause(stm: UCCaseClause): T;
	visitDefaultClause(stm: UCDefaultClause): T;
	visitForStatement(stm: UCForStatement): T;
	visitForEachStatement(stm: UCForEachStatement): T;
	visitReturnStatement(stm: UCReturnStatement): T;
	visitGotoStatement(stm: UCGotoStatement): T;
	visitExpression(expr: IExpression): T;
}

export class DefaultSymbolWalker implements SymbolWalker<ISymbol | IExpression | IStatement | undefined> {
	visit(symbol: ISymbol): ISymbol {
		return symbol;
	}

	visitPackage(symbol: UCPackage): ISymbol {
		return symbol;
	}

	visitObjectType(symbol: UCObjectTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept<any>(this);
		}
		return symbol;
	}

	visitMapType(symbol: UCMapTypeSymbol): ISymbol {
		return symbol;
	}

	visitDelegateType(symbol: UCDelegateTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept<any>(this);
		}
		return symbol;
	}

	visitArrayType(symbol: UCArrayTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept<any>(this);
		}
		return symbol;
	}

	visitStructBase(symbol: UCStructSymbol): ISymbol {
		if (symbol.extendsType) {
			symbol.extendsType.accept<any>(this);
		}

		for (var child = symbol.children; child; child = child.next) {
			child.accept<any>(this);
		}

		if (symbol.block) {
			symbol.block.accept<any>(this);
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol): ISymbol {
		if (symbol.withinType) {
			symbol.withinType.accept<any>(this);
		}

		if (symbol.dependsOnTypes) {
			for (var classTypeRef of symbol.dependsOnTypes) {
				classTypeRef.accept<any>(this);
			}
		}

		if (symbol.implementsTypes) {
			for (var interfaceTypeRef of symbol.implementsTypes) {
				interfaceTypeRef.accept<any>(this);
			}
		}
		return this.visitStructBase(symbol);
	}

	visitConst(symbol: UCConstSymbol): ISymbol {
		if (symbol.expression) {
			symbol.expression.accept<any>(this);
		}
		return symbol;
	}

	visitEnum(symbol: UCEnumSymbol): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitEnumMember(symbol: UCEnumMemberSymbol): ISymbol {
		return symbol;
	}

	visitStruct(symbol: UCStructSymbol): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitScriptStruct(symbol: UCScriptStructSymbol): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitProperty(symbol: UCPropertySymbol): ISymbol {
		if (symbol.type) {
			symbol.type.accept<any>(this);
		}

		if (symbol.arrayDimRef) {
			symbol.arrayDimRef.accept<any>(this);
		}
		return symbol;
	}

	visitMethod(symbol: UCMethodSymbol): ISymbol {
		if (symbol.returnValue) {
			symbol.returnValue.accept<any>(this);
		}
		return this.visitStructBase(symbol);
	}

	visitParameter(symbol: UCParamSymbol): ISymbol {
		if (symbol.defaultExpression) {
			symbol.defaultExpression.accept<any>(this);
		}
		return this.visitProperty(symbol);
	}

	visitLocal(symbol: UCLocalSymbol): ISymbol {
		return this.visitProperty(symbol);
	}

	visitState(symbol: UCStateSymbol): ISymbol {
		if (symbol.ignoreRefs) {
			for (var ref of symbol.ignoreRefs){
				ref.accept<any>(this);
			}
		}
		return this.visitStructBase(symbol);
	}

	visitBlock(symbol: UCBlock): UCBlock {
		return symbol;
	}

	visitReplicationBlock(symbol: UCReplicationBlock): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitObjectSymbol(symbol: UCObjectSymbol): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitExpression(expr: IExpression) {
		return expr;
	}

	visitExpressionStatement(stm: UCExpressionStatement) {
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitLabeledStatement(stm: UCLabeledStatement) {
		return stm;
	}

	visitAssertStatement(stm: UCAssertStatement) {
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitIfStatement(stm: UCIfStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		stm.else?.accept<any>(this);
		return stm;
	}

	visitDoUntilStatement(stm: UCDoUntilStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitWhileStatement(stm: UCWhileStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitSwitchStatement(stm: UCSwitchStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitCaseClause(stm: UCCaseClause) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitDefaultClause(stm: UCDefaultClause) {
		stm.then?.accept<any>(this);
		return stm;
	}

	visitForStatement(stm: UCForStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		stm.init?.accept<any>(this);
		stm.next?.accept<any>(this);
		return stm;
	}

	visitForEachStatement(stm: UCForEachStatement) {
		stm.then?.accept<any>(this);
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitReturnStatement(stm: UCReturnStatement) {
		stm.expression?.accept<any>(this);
		return stm;
	}

	visitGotoStatement(stm: UCGotoStatement) {
		stm.expression?.accept<any>(this);
		return stm;
	}
}