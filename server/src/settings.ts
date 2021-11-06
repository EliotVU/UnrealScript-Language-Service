import { UCGeneration } from './UC/indexer';

export enum EAnalyzeOption {
	None = "None",
	OnlyActive = "OnlyActive",
	All = "All"
}

export type IntrinsicSymbolItemMap = {
    [key: string]: {
        type?: string;
        extends?: string;
    }
}

export interface UCLanguageServerSettings {
	generation: UCGeneration;
	indexAllDocuments?: boolean;
	analyzeDocuments?: EAnalyzeOption;
	checkTypes?: boolean;
	macroSymbols?: {
		[key: string]: string
	};
	intrinsicSymbols: IntrinsicSymbolItemMap
}