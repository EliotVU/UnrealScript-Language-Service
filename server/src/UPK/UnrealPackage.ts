/**
 * Implementation based on UnrealPackage.cs from https://github.com/EliotVU/Unreal-Library
 */
import { UCPackage } from '../UC/Symbols';

export type UnrealPackageSummary = {
    version: number;
    licenseeVersion: number;
}

export class UnrealPackage {
    summary: UnrealPackageSummary;

    constructor(public rootPackage: UCPackage) {

    }
}