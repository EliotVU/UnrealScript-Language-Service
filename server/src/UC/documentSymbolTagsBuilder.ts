import { SymbolTag } from 'vscode-languageserver';

import { ISymbol } from './Symbols';
import { SymbolTagsBuilder } from './SymbolTagsBuilder';

const symbolTagsBuilder = new SymbolTagsBuilder();

export function getSymbolTags(symbol: ISymbol): SymbolTag[] | undefined {
    return symbol.accept(symbolTagsBuilder) as SymbolTag[] | undefined;
}
