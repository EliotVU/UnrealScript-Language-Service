import { Range } from 'vscode-languageserver-types';
import { UCSymbol } from './parser';

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
	constructor(private symbol: UCSymbol, private error: string) {
	}

	getRange(): Range {
		return this.symbol.getIdRange();
	}

	toString(): string {
		return this.error;
	}
}
