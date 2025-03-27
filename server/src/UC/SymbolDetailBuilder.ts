import { type DocumentSymbol } from "vscode-languageserver";

import { UCMethodSymbol } from "./Symbols";
import { DumbSymbolWalker } from "./symbolWalker";

/**
 * A visitor to build the "detail" property for any particular symbol.
 *
 * @see DocumentSymbol.detail
 */
export class SymbolDetailBuilder extends DumbSymbolWalker<string> {
    override visitMethod(symbol: UCMethodSymbol): string {
        return "()";
    }
}
