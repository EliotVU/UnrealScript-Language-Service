export enum UCGeneration {
	UC1 = "1",
	UC2 = "2",
	UC3 = "3"
}

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