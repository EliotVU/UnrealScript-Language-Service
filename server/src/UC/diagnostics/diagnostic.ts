import { Range, DiagnosticSeverity, Diagnostic } from 'vscode-languageserver-types';
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

export class SemanticErrorRangeNode implements IDiagnosticNode {
	constructor(private range: Range, private error: string) {
	}

	getRange(): Range {
		return this.range;
	}

	toString(): string {
		return this.error;
	}
}

export class UnrecognizedTypeNode implements IDiagnosticNode {
	constructor(private symbol: UCSymbol) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return `Type '${this.symbol.getId()}' not found!`;
	}
}

export class UnrecognizedFieldNode implements IDiagnosticNode {
	constructor(private symbol: UCSymbol, private context?: UCSymbol) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return this.context
			? `'${this.symbol.getId()}' Does not exist on type '${this.context.getQualifiedName()}'!`
			: `Couldn't find '${this.symbol.getId()}'!`;
	}
}

// TODO: Deprecate redundant node classes above this comment!

interface IDiagnosticTemplate {
	range: Range;
	message: { text: string, code?: string, severity: DiagnosticSeverity | number };
	args?: string[];
}

export class DiagnosticCollection {
	private items: IDiagnosticTemplate[] = [];

	add(template: IDiagnosticTemplate) {
		this.items.push(template);
	}

	map(): Diagnostic[] {
		return this.items.map(template => {
			const diagnostic: Diagnostic = {
				range: template.range,
				message: template.args
					? template.message.text.replace(/\{(\d)\}/g, (_match, index) => template.args![index])
					: template.message.text,
				severity: template.message.severity as DiagnosticSeverity,
				code: template.message.code,
				source: 'unrealscript'
			};
			return diagnostic;
		});
	}
}