import { UCLanguageSettings } from './UC/indexer';

export enum EAnalyzeOption {
	None = "None",
	OnlyActive = "OnlyActive",
	All = "All"
}

export type UCLanguageServerSettings = UCLanguageSettings & {
    analyzeDocuments?: EAnalyzeOption;
    indexAllDocuments?: boolean;
    indexPackageExtensions?: string[];
    indexDocumentExtensions?: string[];
}