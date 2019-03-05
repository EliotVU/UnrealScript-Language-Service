import { Position, Range } from 'vscode-languageserver-types';

import { UCSymbol, UCReferenceSymbol, UCStructSymbol } from '.';
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
		if (this.reference) {
			let text = this.reference.getQualifiedName();
			if (this.baseType) {
				return text + `<${this.baseType.getTooltip()}>`;
			}
			return text;
		}
		return this.getQualifiedName();
	}

	getTypeText(): string {
		if (this.reference) {
			// use reference getName over innerType so that we can display the resolved name.
			let text = this.reference.getName();
			if (this.baseType) {
				return text + `<${this.baseType.getTypeText()}>`;
			}
			return text;
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
		document.getDocument(this.getName().toLowerCase(), (classDocument => {
			if (classDocument && classDocument.class) {
				this.setReference(classDocument.class, document);
			}
		}));
	}
}