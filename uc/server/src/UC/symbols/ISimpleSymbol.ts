import { SymbolKind } from 'vscode-languageserver-types';

export interface ISimpleSymbol {
	outer?: ISimpleSymbol;
	getName(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getUri(): string;
	getTooltip(): string;
}
