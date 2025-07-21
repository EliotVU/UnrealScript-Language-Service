import type { MacroProvider } from './UC/Parser/MacroProvider';
import { UCLanguageSettings } from './UC/settings';

export enum EAnalyzeOption {
	None = "None",
	OnlyActive = "OnlyActive",
	All = "All"
}

export type UCLanguageServerSettings = UCLanguageSettings & {
    indexPackageExtensions?: string[];
    indexDocumentExtensions?: string[];
    indexAllDocuments?: boolean;
    indexDocumentDebouncePeriod: number;
    analyzeDocuments?: EAnalyzeOption;
    analyzeDocumentDebouncePeriod: number;
}

export function applyUserDefinedMacroSymbols(macroProvider: MacroProvider, symbols?: {
    [key: string]: string | {
        params?: string[],
        text: string
    };
}) {
    if (symbols) {
        // Apply our custom-macros as global symbols (accessible in any uc file).
        const entries = Object.entries(symbols);
        for (const [macroName, macroDefinition] of entries) {
            if (typeof macroDefinition === 'string') {
                macroProvider.setSymbol(macroName.toLowerCase(), { text: macroDefinition });
            } else {
                macroProvider.setSymbol(macroName.toLowerCase(), macroDefinition);
            }
        }
    }
}
