import { SymbolTag } from 'vscode-languageserver';

import { UCObjectSymbol } from './Symbols';
import { SymbolTagsBuilderVisitor } from './SymbolTagsBuilderVisitor';

const SymbolTagsBuilder = new SymbolTagsBuilderVisitor();

export function getSymbolTags(symbol: UCObjectSymbol): SymbolTag[] | undefined {
    return symbol.accept(SymbolTagsBuilder) as SymbolTag[] | undefined;
}