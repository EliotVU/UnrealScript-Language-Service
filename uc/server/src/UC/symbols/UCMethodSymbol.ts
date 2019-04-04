import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { UCSymbol, UCTypeSymbol, UCStructSymbol, UCParamSymbol } from '.';
import { UCDocument, getDocumentByUri } from '../DocumentListener';
import { FunctionDeclContext } from '../../antlr/UCGrammarParser';
import { ISymbol } from './ISymbol';

export class UCMethodSymbol extends UCStructSymbol {
	public returnType?: UCTypeSymbol;
	public overridenMethod?: UCMethodSymbol;
	public params?: UCParamSymbol[];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTypeTooltip(): string {
		return this.overridenMethod
			? '(override) '
			: '';
	}

	getKindText(): string {
		return this.context ? (this.context as FunctionDeclContext).functionKind().text.toLowerCase() : 'function';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + this.getKindText() + ' ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
	}

	getDocumentation(tokenStream) {
		if (!tokenStream) {
			const uri = this.getUri();
			const document = getDocumentByUri(uri);
			if (document) {
				tokenStream = document.tokenStream;
			}
		}

		if (!tokenStream) {
			return undefined;
		}

		const doc = super.getDocumentation(tokenStream);
		if (doc) {
			return doc;
		}

		if (this.overridenMethod) {
			return this.overridenMethod.getDocumentation(undefined);
		}
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.returnType) {
			const returnSymbol = this.returnType.getSymbolAtPos(position);
			if (returnSymbol) {
				return returnSymbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): UCSymbol | undefined {
		return (this.outer as UCStructSymbol).findTypeSymbol(qualifiedId, deepSearch);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		if (this.returnType) {
			this.returnType.index(document, context);
		}

		if (context.super) {
			const method = context.super.findSuperSymbol(this.getName().toLowerCase()) as UCMethodSymbol;
			if (method) {
				method.addReference({ location: Location.create(document.uri, this.getNameRange()), symbol: this });
			}
			this.overridenMethod = method;
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.returnType) {
			this.returnType.analyze(document, context);
		}

		if (this.overridenMethod) {
			// TODO: check difference
		}
	}

	private buildReturnType(): string {
		return this.returnType
			? this.returnType.getTypeText() + ' '
			: '';
	}

	private buildArguments(): string {
		return this.params
			? `(${this.params.map(f => f.type.getTypeText() + ' ' + f.getName()).join(', ')})`
			: '()';
	}
}