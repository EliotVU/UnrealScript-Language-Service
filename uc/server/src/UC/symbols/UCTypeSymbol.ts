import { Position, Range } from 'vscode-languageserver-types';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol, SymbolsTable } from '.';
import { UCTypeKind } from './UCTypeKind';

import { UCDocumentListener } from '../DocumentListener';
import { UnrecognizedTypeNode } from '../diagnostics/diagnostics';

export class UCTypeSymbol extends UCReferenceSymbol {
	public baseType?: UCTypeSymbol;

	constructor(typeName: string, typeRange: Range, private spanRange?: Range, private typeKind?: UCTypeKind) {
		super(typeName, typeRange);
	}

	getSpanRange(): Range {
		return this.spanRange || this.getNameRange();
	}

	getTooltip(): string {
		if (this.baseType) {
			return this.getQualifiedName() + `<${this.baseType.getTooltip()}>`;
		}
		return this.getQualifiedName();
	}

	getTypeText(): string {
		if (this.baseType) {
			return this.getName() + `<${this.baseType.getTypeText()}>`;
		}
		return this.getName();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.baseType) {
			return this.baseType.getSymbolAtPos(position);
		}
		return undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		// console.assert(this.outer, 'No outer for type "' + this.getName() + '"');

		switch (this.typeKind) {
			case UCTypeKind.Class:
				this.linkToClass(document);
				break;

			default:
				const symbol = context.findTypeSymbol(this.getName().toLowerCase(), true);
				if (symbol) {
					this.setReference(symbol, document);
				} else {
					this.linkToClass(document);
				}
				break;
		}

		if (this.baseType) {
			this.baseType.link(document, context);
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.getReference()) {
			if (this.baseType) {
				this.baseType.analyze(document, context);
			}
			return;
		}

		document.nodes.push(new UnrecognizedTypeNode(this));
	}

	private linkToClass(document: UCDocumentListener) {
		const qualifiedClassId = this.getName().toLowerCase();
		const symbol = SymbolsTable.findQualifiedSymbol(qualifiedClassId, true);
		if (symbol) {
			this.setReference(symbol, document);
		}
	}
}