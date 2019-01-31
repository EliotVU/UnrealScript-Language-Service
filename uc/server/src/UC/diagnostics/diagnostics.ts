import { Range } from 'vscode-languageserver-types';
import { UCSymbol, UCReferenceSymbol } from "../symbols";

export interface IDiagnosticNode {
	getRange(): Range;
}

export class SyntaxErrorNode implements IDiagnosticNode {
	constructor(private range: Range, private error: string) {
	}

	getRange(): Range {
		return this.range;
	}

	toString(): string {
		return this.error;
	}
}

export class SemanticErrorNode implements IDiagnosticNode {
	constructor(private symbol: UCSymbol | UCReferenceSymbol, private error: string) {
	}

	getRange(): Range {
		return this.symbol.getIdRange();
	}

	toString(): string {
		return this.error;
	}
}

export class UnrecognizedTypeNode implements IDiagnosticNode {
	constructor(private symbol: UCReferenceSymbol) {
	}

	getRange(): Range {
		return this.symbol.getIdRange();
	}

	toString(): string {
		return `Type '${this.symbol.getName()}' not found!`;
	}
}
