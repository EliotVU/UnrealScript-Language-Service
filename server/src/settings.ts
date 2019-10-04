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
	intrinsicSymbols: {
		[key: string]: {
			type?: string;
			extends?: string;
		}
	};
}

export interface ServerSettings {
	unrealscript: UCOptions;
}