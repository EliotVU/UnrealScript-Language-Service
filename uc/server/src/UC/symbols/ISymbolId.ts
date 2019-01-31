import { Range } from 'vscode-languageserver-types';

export interface ISymbolId {
	text: string;
	range: Range;
}
