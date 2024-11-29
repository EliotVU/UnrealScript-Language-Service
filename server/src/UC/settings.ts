export enum UCGeneration {
    Auto = 'auto',
    UC1 = '1',
    UC2 = '2',
    UC3 = '3'
}

export const enum UELicensee {
    Epic = 'Epic',
    XCom = 'XCom',
}

export type IntrinsicSymbolItemMap = {
    [key: string]: {
        type?: string;
        extends?: string;
    }
};

/**
 * Settings to define or assist with the behavior of UnrealScript
 */
export type UCLanguageSettings = {
    generation: UCGeneration;
    licensee: UELicensee;

    /**
     * Whether to validate if a type is compatible in an expression.
     */
    checkTypes?: boolean;

    /**
     * Globally defined preprocessor macro symbols, e.g. "debug"
     */
    macroSymbols?: {
        [key: string]: string | { params: string[], text: string };
    };

    /**
     * Pre-defined intrinsic symbols that have no UnrealScript counter-part.
     * For instance the class USound in Unreal Engine 1.
     *
     * Alternatively, one could just include a folder with the pseudo counter-parts to the workspace.
     * This would allow one to define more complicated structures.
     */
    intrinsicSymbols: IntrinsicSymbolItemMap;
};
