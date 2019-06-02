import { Range } from 'vscode-languageserver-types';
import { UCSymbol, UCSymbolReference } from "../Symbols";
import { IExpression } from '../expressions';

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

export class ExpressionErrorNode implements IDiagnosticNode {
	constructor(private symbol: IExpression, private error: string) {
	}

	getRange(): Range {
		return this.symbol.getRange()!;
	}

	toString(): string {
		return this.error;
	}
}

export class SemanticErrorNode implements IDiagnosticNode {
	// FIXME: just accept a range
	constructor(private symbol: UCSymbol | UCSymbolReference, private error: string) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return this.error;
	}
}

export class UnrecognizedTypeNode implements IDiagnosticNode {
	constructor(private symbol: UCSymbolReference) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return `Type '${this.symbol.getName()}' not found!`;
	}
}

export class UnrecognizedFieldNode implements IDiagnosticNode {
	constructor(private symbol: UCSymbolReference, private context?: UCSymbol) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return this.context
			? `'${this.symbol.getName()}' Does not exist on type '${this.context.getQualifiedName()}'!`
			: `Couldn't find '${this.symbol.getName()}'!`;
	}
}
