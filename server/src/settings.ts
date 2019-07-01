import { UCGeneration } from './UC/indexer';

export interface UCSettings {
	unrealscript: {
		indexAllDocuments: boolean;
		generation: UCGeneration;
	};
}

export const defaultSettings: UCSettings = {
	unrealscript: {
		indexAllDocuments: false,
		generation: UCGeneration.UC3
	}
};