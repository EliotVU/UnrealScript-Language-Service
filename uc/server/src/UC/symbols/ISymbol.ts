import { SymbolKind, Location, CompletionItem } from 'vscode-languageserver-types';

import { UCDocument } from '../DocumentListener';
import { SymbolVisitor } from '../SymbolVisitor';

export interface ISymbol {
	outer?: ISymbol;
	getName(): string;
	getQualifiedName(): string;
	getKind(): SymbolKind;
	getTooltip(): string;

	toCompletionItem(document: UCDocument): CompletionItem;

	accept<Result>(visitor: SymbolVisitor<Result>): Result;
}

export interface ISymbolContext {
	inAssignment?: boolean;
}

export interface ISymbolReference {
	symbol: ISymbol;
	location: Location;
	context?: ISymbolContext;
}
