import { UCDocument } from './document';
import { IExpression } from './expressions';
import {
    IStatement, UCArchetypeBlockStatement, UCAssertStatement, UCBlock, UCCaseClause,
    UCDefaultClause, UCDoUntilStatement, UCExpressionStatement, UCForEachStatement, UCForStatement,
    UCGotoStatement, UCIfStatement, UCLabeledStatement, UCRepIfStatement, UCReturnStatement,
    UCSwitchStatement, UCWhileStatement
} from './statements';
import {
    ISymbol, UCArchetypeSymbol, UCArrayTypeSymbol, UCClassSymbol, UCConstSymbol,
    UCDefaultPropertiesBlock, UCDelegateTypeSymbol, UCEnumMemberSymbol, UCEnumSymbol, UCFieldSymbol,
    UCInterfaceSymbol, UCLocalSymbol, UCMapTypeSymbol, UCMethodSymbol, UCObjectTypeSymbol,
    UCPackage, UCParamSymbol, UCPropertySymbol, UCQualifiedTypeSymbol, UCReplicationBlock,
    UCScriptStructSymbol, UCStateSymbol, UCStructSymbol, UCTypeSymbol
} from './Symbols';

export interface SymbolWalker<T> {
    visit(symbol: ISymbol): T | void;
    visitDocument(document: UCDocument): T | void;
    visitPackage(symbol: UCPackage): T | void;
    visitType(symbol: UCTypeSymbol): T | void;
    visitQualifiedType(symbol: UCQualifiedTypeSymbol): T | void;
    visitObjectType(symbol: UCObjectTypeSymbol): T | void;
    visitMapType(symbol: UCMapTypeSymbol): T | void;
    visitDelegateType(symbol: UCDelegateTypeSymbol): T | void;
    visitArrayType(symbol: UCArrayTypeSymbol): T | void;
    visitInterface(symbol: UCInterfaceSymbol): T | void;
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
    visitStatement(stm: IStatement): T | void;
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
    visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement): T | void;
    visitExpression(expr: IExpression): T | void;
}

export abstract class DumbSymbolWalker<T> implements SymbolWalker<T> {
    visit(symbol: ISymbol): void | T {
        return;
    }
    visitDocument(document: UCDocument): void | T {
        return;
    }
    visitPackage(symbol: UCPackage): void | T {
        return;
    }
    visitType(symbol: UCTypeSymbol): void | T {
        return;
    }
    visitQualifiedType(symbol: UCQualifiedTypeSymbol): void | T {
        return;
    }
    visitObjectType(symbol: UCObjectTypeSymbol): void | T {
        return;
    }
    visitMapType(symbol: UCMapTypeSymbol): void | T {
        return;
    }
    visitDelegateType(symbol: UCDelegateTypeSymbol): void | T {
        return;
    }
    visitArrayType(symbol: UCArrayTypeSymbol): void | T {
        return;
    }
    visitInterface(symbol: UCInterfaceSymbol): void | T {
        return;
    }
    visitClass(symbol: UCClassSymbol): void | T {
        return;
    }
    visitConst(symbol: UCConstSymbol): void | T {
        return;
    }
    visitEnum(symbol: UCEnumSymbol): void | T {
        return;
    }
    visitEnumMember(symbol: UCEnumMemberSymbol): void | T {
        return;
    }
    visitStruct(symbol: UCStructSymbol): void | T {
        return;
    }
    visitScriptStruct(symbol: UCScriptStructSymbol): void | T {
        return;
    }
    visitProperty(symbol: UCPropertySymbol): void | T {
        return;
    }
    visitMethod(symbol: UCMethodSymbol): void | T {
        return;
    }
    visitParameter(symbol: UCParamSymbol): void | T {
        return;
    }
    visitLocal(symbol: UCLocalSymbol): void | T {
        return;
    }
    visitState(symbol: UCStateSymbol): void | T {
        return;
    }
    visitBlock(symbol: UCBlock): void | T {
        return;
    }
    visitReplicationBlock(symbol: UCReplicationBlock): void | T {
        return;
    }
    visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): void | T {
        return;
    }
    visitArchetypeSymbol(symbol: UCArchetypeSymbol): void | T {
        return;
    }
    visitStatement(stm: IStatement): void | T {
        return;
    }
    visitExpressionStatement(stm: UCExpressionStatement): void | T {
        return;
    }
    visitLabeledStatement(stm: UCLabeledStatement): void | T {
        return;
    }
    visitAssertStatement(stm: UCAssertStatement): void | T {
        return;
    }
    visitIfStatement(stm: UCIfStatement): void | T {
        return;
    }
    visitRepIfStatement(stm: UCRepIfStatement): void | T {
        return;
    }
    visitDoUntilStatement(stm: UCDoUntilStatement): void | T {
        return;
    }
    visitWhileStatement(stm: UCWhileStatement): void | T {
        return;
    }
    visitSwitchStatement(stm: UCSwitchStatement): void | T {
        return;
    }
    visitCaseClause(stm: UCCaseClause): void | T {
        return;
    }
    visitDefaultClause(stm: UCDefaultClause): void | T {
        return;
    }
    visitForStatement(stm: UCForStatement): void | T {
        return;
    }
    visitForEachStatement(stm: UCForEachStatement): void | T {
        return;
    }
    visitReturnStatement(stm: UCReturnStatement): void | T {
        return;
    }
    visitGotoStatement(stm: UCGotoStatement): void | T {
        return;
    }
    visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement): void | T {
        return;
    }
    visitExpression(expr: IExpression): void | T {
        return;
    }
}

export abstract class DefaultSymbolWalker<T = undefined> implements SymbolWalker<T> {
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

    visitType(symbol: UCTypeSymbol): void | T {
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

    // HACK: We need to visit the children in reverse,
    // -- otherwise we end up with non-sorted tokens, which VSCode will ignore.
    // FIXME: This doesn't address the order in @visitClass()
    visitStructBase(symbol: UCStructSymbol) {
        if (symbol.children) {
            const symbols: ISymbol[] = Array(symbol.childrenCount());

            for (let child: UCFieldSymbol | undefined = symbol.children, i = 0; child; child = child.next, ++i) {
                symbols[i] = child;
            }

            for (let i = symbols.length - 1; i >= 0; --i) {
                symbols[i].accept(this);
            }
        }

        if (symbol.block) {
            symbol.block.accept(this);
        }
    }

    visitInterface(symbol: UCInterfaceSymbol) {
        return this.visitClass(symbol);
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

        if (symbol.ignoreRefs) for (const ref of symbol.ignoreRefs) {
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
    }

    visitArchetypeSymbol(symbol: UCArchetypeSymbol) {
        if (symbol.block) {
            symbol.block.accept(this);
        }
    }

    visitStatement(stm: IStatement) {
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

    visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement) {
        stm.archetypeSymbol.accept(this);
    }

    visitExpression(expr: IExpression) {
        return;
    }
}