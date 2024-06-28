import { UCFieldSymbol, UCSymbolKind } from './';
import { ModifierFlags } from './ModifierFlags';

export class UCMacroSymbol extends UCFieldSymbol {
    override kind = UCSymbolKind.Macro;
    override modifiers = ModifierFlags.ReadOnly;
}
