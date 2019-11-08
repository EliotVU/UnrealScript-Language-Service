import { Range, DiagnosticSeverity, Diagnostic } from 'vscode-languageserver-types';
import { UCSymbol, Identifier } from "../Symbols";

export interface IDiagnosticNode {
	getRange(): Range;
}

export class ErrorDiagnostic implements IDiagnosticNode {
	constructor(private range: Range, private error: string) {
	}

	getRange(): Range {
		return this.range;
	}

	toString(): string {
		return this.error;
	}
}

export class SymbolErrorDiagnostic implements IDiagnosticNode {
	constructor(private symbol: { getRange(): Range }, private error: string) {
	}

	getRange(): Range {
		return this.symbol.getRange();
	}

	toString(): string {
		return this.error;
	}
}

export class UnrecognizedTypeDiagnostic implements IDiagnosticNode {
	constructor(private symbol: UCSymbol) {
	}

	getRange(): Range {
		return this.symbol.id.range;
	}

	toString(): string {
		return `Type '${this.symbol.getId()}' not found!`;
	}
}

export class UnrecognizedFieldDiagnostic implements IDiagnosticNode {
	constructor(private id: Identifier, private context?: UCSymbol) {
	}

	getRange(): Range {
		return this.id.range;
	}

	toString(): string {
		return this.context
			? `'${this.id.name}' Does not exist on type '${this.context.getQualifiedName()}'!`
			: `Couldn't find '${this.id.name}'!`;
	}
}

// TODO: Deprecate redundant node classes above this comment!

interface IDiagnosticTemplate {
	range: Range;
	message: { text: string, code?: string, severity?: DiagnosticSeverity | number };
	args?: string[];

	custom?: { [key: string]: any, unnecessary?: {} };
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
			return Object.assign(diagnostic, template.custom);
		});
	}
}