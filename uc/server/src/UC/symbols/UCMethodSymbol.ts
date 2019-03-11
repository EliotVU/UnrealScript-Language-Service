import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { UCSymbol, UCTypeSymbol, UCStructSymbol, UCParamSymbol } from '.';
import { UCDocumentListener } from '../DocumentListener';
import { FunctionDeclContext } from '../../antlr/UCGrammarParser';

export class UCMethodSymbol extends UCStructSymbol {
	public returnType?: UCTypeSymbol;
	public overridenMethod?: UCMethodSymbol;
	public params: UCParamSymbol[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTypeTooltip(): string {
		return this.overridenMethod ? '(override) ' : '';
	}

	getKindText(): string {
		return this.context ? (this.context as FunctionDeclContext).functionKind().text.toLowerCase() : 'function';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + this.getKindText() + ' ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
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
				method.addReference({ location: Location.create(document.uri, this.getNameRange()), symbol: this });
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
		return this.returnType ? this.returnType.getTypeText() + ' ' : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.type.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}
}