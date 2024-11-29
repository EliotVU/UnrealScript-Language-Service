import path from 'node:path';
import type { UCDocument } from '../document';

export type MacroSymbol = {
    params?: string[];
    text: string;
};

export class MacroProvider {
    constructor(
        readonly filePath: string,
        private _symbols = new Map<string, MacroSymbol>(),
        // Needs to be set after parsing
        public superMacroProvider?: MacroProvider,
        readonly globalsMacroProvider?: MacroProvider) {
    }

    getSymbol(macroName: string): MacroSymbol | undefined {
        return this._symbols.get(macroName)
            ?? this.superMacroProvider?.getSymbol(macroName)
            ?? this.globalsMacroProvider?.getSymbol(macroName);
    }

    setSymbol(macroName: string, symbol: MacroSymbol): void {
        this._symbols.set(macroName, symbol);
    }

    deleteSymbol(macroName: string): boolean {
        return this._symbols.delete(macroName);
    }

    setSymbols(symbols = new Map<string, MacroSymbol>()): void {
        this._symbols = symbols;
    }

    clearSymbols(): void {
        this._symbols.clear();
    }
}

export function createMacroProvider(
    document: UCDocument,
    superMacroProvider?: MacroProvider | undefined,
    globalsMacroProvider?: MacroProvider | undefined
): MacroProvider {
    const classNameMacro = path.basename(document.fileName, path.extname(document.fileName));
    const packageNameMacro = document.classPackage.getName().text;

    const macroProvider = new MacroProvider(document.filePath,
        new Map<string, MacroSymbol>([
            ["classname", { text: classNameMacro }],
            ["packagename", { text: packageNameMacro }],
        ]), superMacroProvider, globalsMacroProvider);

    return macroProvider;
}
