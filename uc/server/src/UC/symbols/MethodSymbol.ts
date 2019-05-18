import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { FunctionDeclContext } from '../../antlr/UCGrammarParser';
import { UCDocument, getDocumentByUri } from '../DocumentListener';

import { UCSymbol, UCTypeSymbol, UCStructSymbol, UCParamSymbol } from '.';
import { SymbolVisitor } from '../SymbolVisitor';
import { ISymbol, IWithReference } from './ISymbol';

export class UCMethodSymbol extends UCStructSymbol {
	public returnType?: UCTypeSymbol;
	public overriddenMethod?: UCMethodSymbol;
	public params?: UCParamSymbol[];

	// TODO: reflect parsed modifier.
	isStatic(): boolean {
		return false;
	}

	// TODO: reflect parsed modifier.
	isFinal(): boolean {
		return this.isStatic();
	}

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
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

		if (this.overriddenMethod) {
			return this.overriddenMethod.getDocumentation(undefined);
		}
	}

	getContainedSymbolAtPos(position: Position): UCSymbol {
		if (this.returnType) {
			const returnSymbol = this.returnType.getSymbolAtPos(position);
			if (returnSymbol) {
				return returnSymbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findTypeSymbol(qualifiedId: string, deepSearch: boolean): UCSymbol {
		// Redirect to outer, because Methods are never supposed to have any type members!
		return (this.outer as UCStructSymbol).findTypeSymbol(qualifiedId, deepSearch);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		if (this.returnType) {
			this.returnType.index(document, context);
		}

		if (context.super) {
			const method = context.super.findSuperSymbol(this.getId()) as UCMethodSymbol;
			if (method) {
				method.indexReference(document, {
					location: Location.create(document.uri, this.getNameRange()),
					symbol: this
				});
			}
			this.overriddenMethod = method;
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.returnType) {
			this.returnType.analyze(document, context);
		}

		if (this.overriddenMethod) {
			// TODO: check difference
		}
	}

	accept<Result>(visitor: SymbolVisitor<Result>): Result {
		return visitor.visitMethod(this);
	}

	getTypeTooltip(): string {
		return this.overriddenMethod && '(override)';
	}

	getKindText(): string {
		return this.context
			? (this.context as FunctionDeclContext).functionKind().text.toLowerCase()
			: 'function';
	}

	getTooltip(): string {
		const text: string[] = [];

		text.push(this.getTypeTooltip());

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		text.push(this.getKindText());
		text.push(this.buildReturnType());
		text.push(this.getQualifiedName() + this.buildParameters());

		return text.filter(s => s).join(' ');
	}

	protected buildModifiers(): string[] {
		let text = super.buildModifiers();

		if (this.isStatic()) {
			text.push('static');
		}
		// isStatic is implicit final
		else if (this.isFinal()) {
			text.push('final');
		}

		return text;
	}

	// TODO: Print return modifiers? (e.g. coerce)
	protected buildReturnType(): string {
		return this.returnType && this.returnType.getTypeText();
	}

	// TODO: Print param modifiers?
	protected buildParameters(): string {
		return this.params
			? `(${this.params.map(f => f.type.getTypeText() + ' ' + f.getName()).join(', ')})`
			: '()';
	}
}

export class UCMethodLikeSymbol extends UCMethodSymbol implements IWithReference {
	constructor(name: string, protected kind?: string) {
		super(name);
	}

	isStatic() {
		return true;
	}

	isFinal() {
		return true;
	}

	isNative() {
		return true;
	}

	getTypeTooltip(): string {
		return '(intrinsic)';
	}

	getKindText(): string {
		return this.kind || 'function'; // placeholder
	}

	getReference(): ISymbol {
		return this.returnType && this.returnType.getReference();
	}
}