import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';

import {
	DEFAULT_RANGE,
	UCStructSymbol, UCParamSymbol,
	ITypeSymbol, ISymbol,
	IWithReference, UCTypeKind
} from '.';

export enum MethodSpecifiers {
	None 			= 0x0000,
	Function 		= 0x0001,
	Operator 		= 0x0002,
	PreOperator 	= 0x0004,
	PostOperator 	= 0x0008,
	Event 			= 0x0010,
	Delegate 		= 0x0020,
	Static 			= 0x0040,
	Final 			= 0x0080,

	HasKind			= Function | Operator | PreOperator | PostOperator | Event | Delegate
}

export class UCMethodSymbol extends UCStructSymbol {
	public specifiers: MethodSpecifiers = MethodSpecifiers.None;

	public returnType?: ITypeSymbol;
	public overriddenMethod?: UCMethodSymbol;

	public params?: UCParamSymbol[];

	/**
	 * Required count for a proper function call, this is exclusive of optional params.
	 * This value is initialized when analyze() is called on this symbol; remains undefined if no params.
	 */
	public requiredParamsCount?: number;

	isStatic(): boolean {
		return (this.specifiers & MethodSpecifiers.Static) !== 0;
	}

	isFinal(): boolean {
		return (this.specifiers & MethodSpecifiers.Final) !== 0 || this.isStatic();
	}

	/**
	 * Returns true if this method is marked as a (binary) operator.
	 * Beware that this returns false even when the method is a preoperator!
	 */
	isOperator() {
		return (this.specifiers & MethodSpecifiers.Operator) !== 0;
	}

	isPreOperator() {
		return (this.specifiers & MethodSpecifiers.PreOperator) !== 0;
	}

	isPostOperator() {
		return (this.specifiers & MethodSpecifiers.PostOperator) !== 0;
	}

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getTypeKind() {
		return this.returnType ? this.returnType.getTypeKind() : UCTypeKind.Error;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getDocumentation() {
		const doc = super.getDocumentation();
		if (doc) {
			return doc;
		}

		if (this.overriddenMethod) {
			return this.overriddenMethod.getDocumentation();
		}
	}

	getContainedSymbolAtPos(position: Position) {
		if (this.returnType) {
			const returnSymbol = this.returnType.getSymbolAtPos(position);
			if (returnSymbol) {
				return returnSymbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findSuperSymbol(id: Name, kind?: SymbolKind) {
		return this.getSymbol(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id, kind);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.returnType) {
			this.returnType.index(document, context);
		}

		super.index(document, context);

		if (context.super) {
			const overriddenMethod = context.super.findSuperSymbol(this.getId());
			if (overriddenMethod instanceof UCMethodSymbol) {
				document.indexReference(overriddenMethod, {
					location: Location.create(document.filePath, this.id.range),
					symbol: this
				});
				this.overriddenMethod = overriddenMethod;
			}
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitMethod(this);
	}

	protected getTypeKeyword(): string {
		return 'function';
	}

	getTooltip(): string {
		const text: Array<string | undefined> = [];

		if (this.overriddenMethod) {
			text.push('(override)');
		}

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		text.push(this.getTypeKeyword());
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
	protected buildReturnType(): string | undefined {
		return this.returnType && this.returnType.getTypeText();
	}

	// TODO: Print param modifiers?
	protected buildParameters(): string {
		return this.params
			? `(${this.params.map(f => f.getTextForSignature()).join(', ')})`
			: '()';
	}
}

export class UCMethodLikeSymbol extends UCMethodSymbol implements IWithReference {
	constructor(name: Name, protected kind?: string) {
		super({ name, range: DEFAULT_RANGE });
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

	protected getTypeKeyword(): string {
		return '(intrinsic)';
	}

	getReference(): ISymbol | undefined {
		return this.returnType && this.returnType.getReference();
	}
}

export class UCEventSymbol extends UCMethodSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Event;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Event;
	}

	protected getTypeKeyword(): string {
		return 'event';
	}
}

export class UCDelegateSymbol extends UCMethodSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	protected getTypeKeyword(): string {
		return 'delegate';
	}
}

export abstract class UCBaseOperatorSymbol extends UCMethodSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Operator;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Operator;
	}

	acceptCompletion(document: UCDocument, context: ISymbol): boolean {
		// FIXME: Should check outer, but currently it's too much of a pain to step through.
		// Basically we don't want operators to be visible when the context is not in the same document!
		return context instanceof UCStructSymbol && context.getUri() === document.filePath;
	}
}

export class UCBinaryOperatorSymbol extends UCBaseOperatorSymbol {
	precedence?: number;

	protected getTypeKeyword(): string {
		return `operator(${this.precedence})`;
	}
}

export class UCPreOperatorSymbol extends UCBaseOperatorSymbol {
	protected getTypeKeyword(): string {
		return 'preoperator';
	}
}

export class UCPostOperatorSymbol extends UCBaseOperatorSymbol {
	protected getTypeKeyword(): string {
		return 'postoperator';
	}
}