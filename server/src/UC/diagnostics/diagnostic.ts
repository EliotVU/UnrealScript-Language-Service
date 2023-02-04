import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver-types';

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

export interface IDiagnosticMessage {
	text: string;
	code?: string;
	severity?: DiagnosticSeverity | number
}

export interface IDiagnosticTemplate {
	range: Range;
	message: IDiagnosticMessage;
	args?: string[];

	custom?: { [key: string]: any };
}

export class DiagnosticCollection {
	private items: IDiagnosticTemplate[] = [];

	add(template: IDiagnosticTemplate) {
		this.items.push(template);
	}

    count(): number {
        return this.items.length;
    }

	toDiagnostic(): Diagnostic[] {
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