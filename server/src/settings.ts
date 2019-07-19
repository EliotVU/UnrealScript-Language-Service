import { UCGeneration } from './UC/indexer';

export interface UCOptions {
	generation: UCGeneration;
	indexAllDocuments?: boolean;
	analyzeDocuments?: boolean;
	checkTypes?: boolean;
}

export interface ServerSettings {
	unrealscript: UCOptions;
}

export const defaultSettings: ServerSettings = {
	unrealscript: {
		generation: UCGeneration.UC3,
		indexAllDocuments: false,
		analyzeDocuments: true,
		checkTypes: false
	}
};