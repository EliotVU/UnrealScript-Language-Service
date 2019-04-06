import { SymbolKind, Location, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';

export interface ISymbol {
	outer?: ISymbol;
	getName(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getTooltip(): string;

	toCompletionItem(document: UCDocument): CompletionItem;
}

export interface ISymbolContext {
	inAssignment?: boolean;
}

export interface ISymbolReference {
	symbol: ISymbol;
	location: Location;
	context?: ISymbolContext;
}
