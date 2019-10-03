import { UCGeneration } from './UC/indexer';


export enum EAnalyzeOption {
	"None",
	"OnlyActive",
	"All"
}

export interface UCOptions {
	generation: UCGeneration;
	indexAllDocuments?: boolean;
	analyzeDocuments?: EAnalyzeOption;
	checkTypes?: boolean;
	macroSymbols?: {
		[key: string]: string
	};
}

export interface ServerSettings {
	unrealscript: UCOptions;
}

export const defaultSettings: ServerSettings = {
	unrealscript: {
		generation: UCGeneration.UC3,
		indexAllDocuments: false,
		analyzeDocuments: EAnalyzeOption.OnlyActive,
		checkTypes: false
	}
};