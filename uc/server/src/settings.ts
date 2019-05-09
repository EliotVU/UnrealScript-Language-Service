export enum UCGeneration {
	UC1 = "1",
	UC2 = "2",
	UC3 = "3"
}

export interface UCSettings {
	indexAllDocuments: boolean;
	unrealscript: {
		generation: UCGeneration;
	}
}

export const defaultSettings: UCSettings = {
	indexAllDocuments: false,
	unrealscript: {
		generation: UCGeneration.UC3
	}
}