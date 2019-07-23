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
} from './Symbols';

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
	visitScriptStruct(symbol: UCScriptStructSymbol): T;
	visitProperty(symbol: UCPropertySymbol): T;
	visitMethod(symbol: UCMethodSymbol): T;
	visitParameter(symbol: UCParamSymbol): T;
	visitLocal(symbol: UCLocalSymbol): T;
	visitState(symbol: UCStateSymbol): T;
}

export class DefaultSymbolWalker implements SymbolWalker<ISymbol> {
	visit(symbol: ISymbol): ISymbol {
		return symbol;
	}

	visitPackage(symbol: UCPackage): ISymbol {
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

		for (var child = symbol.children; child; child = child.next) {
			child.accept(this);
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol): ISymbol {
		if (symbol.withinType) {
			symbol.withinType.accept(this);
		}

		if (symbol.dependsOnTypes) {
			for (var classTypeRef of symbol.dependsOnTypes) {
				classTypeRef.accept(this);
			}
		}

		if (symbol.implementsTypes) {
			for (var interfaceTypeRef of symbol.implementsTypes) {
				interfaceTypeRef.accept(this);
			}
		}
		return this.visitStructBase(symbol);
	}

	visitConst(symbol: UCConstSymbol): ISymbol {
		return symbol;
	}

	visitEnum(symbol: UCEnumSymbol): ISymbol {
		return this.visitStructBase(symbol);
	}

	visitEnumMember(symbol: UCEnumMemberSymbol): ISymbol {
		return symbol;
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
		if (symbol.returnType) {
			symbol.returnType.accept(this);
		}
		return this.visitStructBase(symbol);
	}

	visitParameter(symbol: UCParamSymbol): ISymbol {
		return this.visitProperty(symbol);
	}

	visitLocal(symbol: UCLocalSymbol): ISymbol {
		return this.visitProperty(symbol);
	}

	visitState(symbol: UCStateSymbol): ISymbol {
		if (symbol.ignoreRefs) {
			for (var ref of symbol.ignoreRefs){
				ref.accept(this);
			}
		}
		return this.visitStructBase(symbol);
	}
}