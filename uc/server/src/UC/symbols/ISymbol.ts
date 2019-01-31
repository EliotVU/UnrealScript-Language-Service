import { SymbolKind } from 'vscode-languageserver-types';

export interface ISymbol {
	outer?: ISymbol;
	getName(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getUri(): string;
	getTooltip(): string;
}
