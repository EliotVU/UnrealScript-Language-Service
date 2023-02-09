import { UCFieldSymbol, UCSymbolKind } from './';

export class UCMacroSymbol extends UCFieldSymbol {
    override kind = UCSymbolKind.Macro;
}
