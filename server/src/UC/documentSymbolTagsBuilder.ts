import { SymbolTag } from 'vscode-languageserver';

import { ISymbol } from './Symbols';
import { SymbolTagsBuilderVisitor } from './SymbolTagsBuilderVisitor';

const SymbolTagsBuilder = new SymbolTagsBuilderVisitor();

export function getSymbolTags(symbol: ISymbol): SymbolTag[] | undefined {
    return symbol.accept(SymbolTagsBuilder) as SymbolTag[] | undefined;
}
