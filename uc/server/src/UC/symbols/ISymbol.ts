import { SymbolKind, Location } from 'vscode-languageserver-types';

export interface ISymbol {
	outer?: ISymbol;
	getName(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getUri(): string;
	getTooltip(): string;
}

export interface ISymbolContext {
	inAssignment?: boolean;
}

export interface ISymbolReference {
	symbol: ISymbol;
	location: Location;
	context?: ISymbolContext;
}
