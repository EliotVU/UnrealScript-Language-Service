import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { UCSymbol, UCTypeSymbol, UCStructSymbol, UCParamSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';

export class UCMethodSymbol extends UCStructSymbol {
	public returnType?: UCTypeSymbol;
	public params: UCParamSymbol[] = [];
	public overridenMethod?: UCMethodSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTypeTooltip(): string {
		return this.overridenMethod ? '(method override)' : '(method)';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + ' ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.returnType) {
			const returnSymbol = this.returnType.getSymbolAtPos(position);
			if (returnSymbol) {
				return returnSymbol;
			}
		}
		return super.getSubSymbolAtPos(position);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document, context);

		if (this.returnType) {
			this.returnType.link(document, context);
		}

		if (context.super) {
			const method = context.super.findSuperSymbol(this.getName().toLowerCase()) as UCMethodSymbol;
			if (method) {
				method.registerReference(Location.create(document.uri, this.getRange()));
			}
			this.overridenMethod = method;
		}
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.returnType) {
			this.returnType.analyze(document, context);
		}

		if (this.overridenMethod) {
			// TODO: check difference
		}
	}

	private buildReturnType(): string {
		return this.returnType ? this.returnType.getName() + ' ' : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}
}