import { UCDocument } from './document';
import { IExpression } from './expressions';
import {
    UCAssertStatement, UCBlock, UCCaseClause, UCDefaultClause, UCDoUntilStatement,
    UCExpressionStatement, UCForEachStatement, UCForStatement, UCGotoStatement, UCIfStatement,
    UCLabeledStatement, UCRepIfStatement, UCReturnStatement, UCSwitchStatement, UCWhileStatement
} from './statements';
import {
    ISymbol, UCArchetypeSymbol, UCArrayTypeSymbol, UCClassSymbol, UCConstSymbol,
    UCDefaultPropertiesBlock, UCDelegateTypeSymbol, UCEnumMemberSymbol, UCEnumSymbol, UCLocalSymbol,
    UCMapTypeSymbol, UCMethodSymbol, UCObjectTypeSymbol, UCPackage, UCParamSymbol, UCPropertySymbol,
    UCQualifiedTypeSymbol, UCReplicationBlock, UCScriptStructSymbol, UCStateSymbol, UCStructSymbol
} from './Symbols';

export interface SymbolWalker<T> {
	visit(symbol: ISymbol): T | void;
    visitDocument(document: UCDocument): T | void;
	visitPackage(symbol: UCPackage): T | void;
	visitQualifiedType(symbol: UCQualifiedTypeSymbol): T | void;
	visitObjectType(symbol: UCObjectTypeSymbol): T | void;
	visitMapType(symbol: UCMapTypeSymbol): T | void;
	visitDelegateType(symbol: UCDelegateTypeSymbol): T | void;
	visitArrayType(symbol: UCArrayTypeSymbol): T | void;
	visitClass(symbol: UCClassSymbol): T | void;
	visitConst(symbol: UCConstSymbol): T | void;
	visitEnum(symbol: UCEnumSymbol): T | void;
	visitEnumMember(symbol: UCEnumMemberSymbol): T | void;
	visitStruct(symbol: UCStructSymbol): T | void;
	visitScriptStruct(symbol: UCScriptStructSymbol): T | void;
	visitProperty(symbol: UCPropertySymbol): T | void;
	visitMethod(symbol: UCMethodSymbol): T | void;
	visitParameter(symbol: UCParamSymbol): T | void;
	visitLocal(symbol: UCLocalSymbol): T | void;
	visitState(symbol: UCStateSymbol): T | void;
	visitBlock(symbol: UCBlock): T | void;
	visitReplicationBlock(symbol: UCReplicationBlock): T | void;
	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): T | void;
	visitArchetypeSymbol(symbol: UCArchetypeSymbol): T | void;
	visitExpressionStatement(stm: UCExpressionStatement): T | void;
	visitLabeledStatement(stm: UCLabeledStatement): T | void;
	visitAssertStatement(stm: UCAssertStatement): T | void;
	visitIfStatement(stm: UCIfStatement): T | void;
	visitRepIfStatement(stm: UCRepIfStatement): T | void;
	visitDoUntilStatement(stm: UCDoUntilStatement): T | void;
	visitWhileStatement(stm: UCWhileStatement): T | void;
	visitSwitchStatement(stm: UCSwitchStatement): T | void;
	visitCaseClause(stm: UCCaseClause): T | void;
	visitDefaultClause(stm: UCDefaultClause): T | void;
	visitForStatement(stm: UCForStatement): T | void;
	visitForEachStatement(stm: UCForEachStatement): T | void;
	visitReturnStatement(stm: UCReturnStatement): T | void;
	visitGotoStatement(stm: UCGotoStatement): T | void;
	visitExpression(expr: IExpression): T | void;
}

export class DefaultSymbolWalker<T> implements SymbolWalker<T> {
	visit(symbol: ISymbol) {
        return;
	}

    visitDocument(document: UCDocument) {
        const symbols = document.getSymbols();
        for (const symbol of symbols) {
            symbol.accept(this);
        }
    }

	visitPackage(symbol: UCPackage) {
		return;
	}

	visitQualifiedType(symbol: UCQualifiedTypeSymbol) {
		symbol.left?.accept(this);
		symbol.type.accept(this);
	}

	visitObjectType(symbol: UCObjectTypeSymbol) {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
	}

	visitMapType(symbol: UCMapTypeSymbol) {
		return;
	}

	visitDelegateType(symbol: UCDelegateTypeSymbol) {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
	}

	visitArrayType(symbol: UCArrayTypeSymbol) {
		if (symbol.baseType) {
			symbol.baseType.accept(this);
		}
	}

	visitStructBase(symbol: UCStructSymbol) {
		for (let child = symbol.children; child; child = child.next) {
			child.accept(this);
		}

		if (symbol.block) {
			symbol.block.accept(this);
		}
	}

	visitClass(symbol: UCClassSymbol) {
        if (symbol.extendsType) {
			symbol.extendsType.accept(this);
		}

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

	visitConst(symbol: UCConstSymbol) {
		if (symbol.expression) {
			symbol.expression.accept(this);
		}
	}

	visitEnum(symbol: UCEnumSymbol) {
        for (let child = symbol.children; child; child = child.next) {
			child.accept(this);
		}
	}

	visitEnumMember(symbol: UCEnumMemberSymbol) {
		return;
	}

	visitStruct(symbol: UCStructSymbol) {
		return this.visitStructBase(symbol);
	}

	visitScriptStruct(symbol: UCScriptStructSymbol) {
        if (symbol.extendsType) {
			symbol.extendsType.accept(this);
		}
		return this.visitStructBase(symbol);
	}

	visitProperty(symbol: UCPropertySymbol) {
		if (symbol.type) {
			symbol.type.accept(this);
		}

		if (symbol.arrayDimRef) {
			symbol.arrayDimRef.accept(this);
		}
		return;
	}

	visitMethod(symbol: UCMethodSymbol) {
		if (symbol.returnValue) {
			symbol.returnValue.accept(this);
		}
		return this.visitStructBase(symbol);
	}

	visitParameter(symbol: UCParamSymbol) {
        this.visitProperty(symbol);
		if (symbol.defaultExpression) {
			symbol.defaultExpression.accept(this);
		}
		return;
	}

	visitLocal(symbol: UCLocalSymbol) {
		return this.visitProperty(symbol);
	}

	visitState(symbol: UCStateSymbol) {
        if (symbol.extendsType) {
			symbol.extendsType.accept(this);
		}

		if (symbol.ignoreRefs) for (const ref of symbol.ignoreRefs){
            ref.accept(this);
		}
		return this.visitStructBase(symbol);
	}

	visitBlock(symbol: UCBlock) {
        return;
	}

	visitReplicationBlock(symbol: UCReplicationBlock) {
		return this.visitStructBase(symbol);
	}

	visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock) {
		if (symbol.block) {
			symbol.block.accept(this);
		}
		// Each child is already registered as a statement, thus will be indexed by the block.index call!
		// return this.visitStructBase(symbol);
	}

	visitArchetypeSymbol(symbol: UCArchetypeSymbol) {
        return;
	}

	visitExpression(expr: IExpression) {
		return;
	}

	visitExpressionStatement(stm: UCExpressionStatement) {
		stm.expression?.accept(this);
	}

	visitLabeledStatement(stm: UCLabeledStatement) {
		return;
	}

	visitAssertStatement(stm: UCAssertStatement) {
		stm.expression?.accept(this);
	}

	visitIfStatement(stm: UCIfStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
		stm.else?.accept(this);
	}

	visitRepIfStatement(stm: UCRepIfStatement) {
		stm.expression?.accept(this);
        if (stm.symbolRefs) for (const ref of stm.symbolRefs) {
            ref.accept(this);
        }
	}

	visitDoUntilStatement(stm: UCDoUntilStatement) {
		stm.then?.accept(this);
		stm.expression?.accept(this);
	}

	visitWhileStatement(stm: UCWhileStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
	}

	visitSwitchStatement(stm: UCSwitchStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
	}

	visitCaseClause(stm: UCCaseClause) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
	}

	visitDefaultClause(stm: UCDefaultClause) {
		stm.then?.accept(this);
	}

	visitForStatement(stm: UCForStatement) {
		stm.init?.accept(this);
		stm.expression?.accept(this);
		stm.next?.accept(this);
		stm.then?.accept(this);
	}

	visitForEachStatement(stm: UCForEachStatement) {
		stm.expression?.accept(this);
		stm.then?.accept(this);
	}

	visitReturnStatement(stm: UCReturnStatement) {
		stm.expression?.accept(this);
	}

	visitGotoStatement(stm: UCGotoStatement) {
		stm.expression?.accept(this);
	}
}