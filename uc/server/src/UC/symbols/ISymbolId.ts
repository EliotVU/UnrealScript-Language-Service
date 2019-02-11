import { Range } from 'vscode-languageserver-types';

export interface ISymbolId {
	name: string;
	range: Range;
}
