import { Position, Range } from 'vscode-languageserver-types';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol, SymbolsTable, CORE_PACKAGE } from '.';
import { UCTypeKind } from './UCTypeKind';

import { UCDocument } from '../DocumentListener';
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

	link(document: UCDocument, context: UCStructSymbol) {
		// console.assert(this.outer, 'No outer for type "' + this.getName() + '"');

		switch (this.typeKind) {
			case UCTypeKind.Class:
				this.linkToClass(document);
				break;

			default:
				const id = this.getName().toLowerCase();
				// Quick shortcut for the most common types or top level symbols.
				let symbol = CORE_PACKAGE.findQualifiedSymbol(id, false);
				if (!symbol) {
					symbol = context.findTypeSymbol(id, true);
				}

				if (symbol) {
					this.setReference(symbol, document);
				} else {
					this.linkToClass(document);
				}
		}

		if (this.baseType) {
			this.baseType.link(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.getReference()) {
			if (this.baseType) {
				this.baseType.analyze(document, context);
			}
			return;
		}

		document.nodes.push(new UnrecognizedTypeNode(this));
	}

	private linkToClass(document: UCDocument) {
		const qualifiedClassId = this.getName().toLowerCase();
		const symbol = SymbolsTable.findQualifiedSymbol(qualifiedClassId, true);
		if (symbol) {
			this.setReference(symbol, document);
		}
	}
}