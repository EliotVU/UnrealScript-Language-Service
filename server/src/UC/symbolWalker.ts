import { UCDocument } from './document';
import { IExpression } from './expressions';
import {
    UCAssertStatement, UCBlock, UCCaseClause, UCDefaultClause, UCDoUntilStatement,
    UCExpressionStatement, UCForEachStatement, UCForStatement, UCGotoStatement, UCIfStatement,
    UCLabeledStatement, UCReturnStatement, UCSwitchStatement, UCWhileStatement
} from './statements';
import {
    ISymbol, UCArrayTypeSymbol, UCClassSymbol, UCConstSymbol, UCDefaultPropertiesBlock,
    UCDelegateTypeSymbol, UCEnumMemberSymbol, UCEnumSymbol, UCLocalSymbol, UCMapTypeSymbol,
    UCMethodSymbol, UCObjectSymbol, UCObjectTypeSymbol, UCPackage, UCParamSymbol, UCPropertySymbol,
    UCQualifiedTypeSymbol, UCReplicationBlock, UCScriptStructSymbol, UCStateSymbol, UCStructSymbol
} from './Symbols';

export interface SymbolWalker<T> {
	visit(symbol: ISymbol): T;
    visitDocument(document: UCDocument): T;
	visitPackage(symbol: UCPackage): T;
	visitQualifiedType(symbol: UCQualifiedTypeSymbol): T;
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

export class DefaultSymbolWalker implements SymbolWalker<ISymbol | undefined> {
	visit(symbol: ISymbol): ISymbol {
		return symbol;
	}

    visitDocument(document: UCDocument): undefined {
        const symbols = document.getSymbols();
        for (const symbol of symbols) {
            symbol.accept(this);
        }
        return undefined;
    }

	visitPackage(symbol: UCPackage): ISymbol {
		return symbol;
	}

	visitQualifiedType(symbol: UCQualifiedTypeSymbol): ISymbol {
		symbol.left?.accept(this);
		symbol.type.accept(this);
		return symbol;
	}

	visitObjectType(symbol: UCObjectTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
		return symbol;
	}

	visitMapType(symbol: UCMapTypeSymbol): ISymbol {
		return symbol;
	}

	visitDelegateType(symbol: UCDelegateTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
		return symbol;
	}

	visitArrayType(symbol: UCArrayTypeSymbol): ISymbol {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
		return symbol;
	}

	visitStructBase(symbol: UCStructSymbol): ISymbol {
		if (symbol.extendsType) {
			symbol.extendsType.accept(this);
		}

		for (let child = symbol.children; child; child = child.next) {
			child.accept(this);
		}

		if (symbol.block) {
			symbol.block.accept(this);
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol): ISymbol {
		if (symbol.withinType) {
			symbol.withinType.accept(this);
		}

		if (symbol.dependsOnTypes) {
			for (const classTypeRef of symbol.dependsOnTypes) {
				classTypeRef.accept(this);
			}
		}

		if (symbol.implementsTypes) {
			for (const interfaceTypeRef of symbol.implementsTypes) {
				interfaceTypeRef.accept(this);
			}
		}
		return this.visitStructBase(symbol);
	}

	visitConst(symbol: UCConstSymbol): ISymbol {
		if (symbol.expression) {
			symbol.expression.accept(this);
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
			symbol.type.accept(this);
		}

		if (symbol.arrayDimRef) {
			symbol.arrayDimRef.accept(this);
		}
		return symbol;
	}

	visitMethod(symbol: UCMethodSymbol): ISymbol {
		if (symbol.returnValue) {
			symbol.returnValue.accept(this);
		}
		return this.visitStructBase(symbol);
	}

	visitParameter(symbol: UCParamSymbol): ISymbol {
        this.visitProperty(symbol);
		if (symbol.defaultExpression) {
			symbol.defaultExpression.accept(this);
		}
		return symbol;
	}

	visitLocal(symbol: UCLocalSymbol): ISymbol {
		return this.visitProperty(symbol);
	}

	visitState(symbol: UCStateSymbol): ISymbol {
		if (symbol.ignoreRefs) {
			for (const ref of symbol.ignoreRefs){
				ref.accept(this);
			}
		}
		return this.visitStructBase(symbol);
	}

	visitBlock(symbol: UCBlock): undefined {
        return undefined;
	}

	visitReplicationBlock(symbol: UCReplicationBlock): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): ISymbol {
		if (symbol.block) {
			symbol.block.accept(this);
		}
		return symbol;
		// Each child is already registered as a statement, thus will be indexed by the block.index call!
		// return this.visitStructBase(symbol);
	}

	visitObjectSymbol(symbol: UCObjectSymbol): ISymbol {
		if (symbol.block) {
			symbol.block.accept(this);
		}
		return symbol;
		// Each child is already registered as a statement, thus will be indexed by the block.index call!
		// return this.visitStructBase(symbol);
	}

	visitExpression(expr: IExpression) {
		return undefined;
	}

	visitExpressionStatement(stm: UCExpressionStatement) {
		stm.expression?.accept(this);
		return undefined;
	}

	visitLabeledStatement(stm: UCLabeledStatement) {
		return undefined;
	}

	visitAssertStatement(stm: UCAssertStatement) {
		stm.expression?.accept(this);
		return undefined;
	}

	visitIfStatement(stm: UCIfStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		stm.else?.accept(this);
		return undefined;
	}

	visitDoUntilStatement(stm: UCDoUntilStatement) {
		stm.then?.accept(this);
		stm.expression?.accept(this);
		return undefined;
	}

	visitWhileStatement(stm: UCWhileStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		return undefined;
	}

	visitSwitchStatement(stm: UCSwitchStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		return undefined;
	}

	visitCaseClause(stm: UCCaseClause) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		return undefined;
	}

	visitDefaultClause(stm: UCDefaultClause) {
		stm.then?.accept(this);
		return undefined;
	}

	visitForStatement(stm: UCForStatement) {
		stm.init?.accept(this);
		stm.expression?.accept(this);
		stm.next?.accept(this);
		stm.then?.accept(this);
		return undefined;
	}

	visitForEachStatement(stm: UCForEachStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		return undefined;
	}

	visitReturnStatement(stm: UCReturnStatement) {
		stm.expression?.accept(this);
		return undefined;
	}

	visitGotoStatement(stm: UCGotoStatement) {
		stm.expression?.accept(this);
		return undefined;
	}
}