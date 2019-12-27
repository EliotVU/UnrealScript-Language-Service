import { CompletionItemKind, Location, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name, NAME_ACTOR, NAME_ENGINE, NAME_SPAWN } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_RANGE, ISymbol, IWithReference, ParamModifiers, UCParamSymbol, UCStructSymbol, UCSymbol,
    UCTypeFlags
} from './';

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

	OperatorKind 	= Operator | PreOperator | PostOperator,
	HasKind			= Function | OperatorKind | Event | Delegate
}

export class UCMethodSymbol extends UCStructSymbol {
	public specifiers: MethodSpecifiers = MethodSpecifiers.None;

	public returnValue?: UCParamSymbol;
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
	isOperator(): this is UCBinaryOperatorSymbol {
		return (this.specifiers & MethodSpecifiers.Operator) !== 0;
	}

	isOperatorKind(): this is UCBaseOperatorSymbol {
		return (this.specifiers & MethodSpecifiers.OperatorKind) !== 0;
	}

	isPreOperator(): this is UCPreOperatorSymbol {
		return (this.specifiers & MethodSpecifiers.PreOperator) !== 0;
	}

	isPostOperator(): this is UCPostOperatorSymbol {
		return (this.specifiers & MethodSpecifiers.PostOperator) !== 0;
	}

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getTypeFlags() {
		return UCTypeFlags.Function;
	}

	getType() {
		return this.returnValue?.getType();
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getDocumentation(): string | undefined {
		const doc = super.getDocumentation();
		if (doc) {
			return doc;
		}

		if (this.overriddenMethod) {
			return this.overriddenMethod.getDocumentation();
		}
	}

	getContainedSymbolAtPos(position: Position) {
		return this.returnValue?.getSymbolAtPos(position) ?? super.getContainedSymbolAtPos(position);
	}

	getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: string, kind?: UCTypeFlags) {
		if (context === '.') {
			const resolvedType = this.returnValue?.getType()?.getRef();
			if (resolvedType instanceof UCSymbol) {
				return resolvedType.getCompletionSymbols<C>(document, context, kind);
			}
		}
		return super.getCompletionSymbols<C>(document, context, kind);
	}

	findSuperSymbol(id: Name, kind?: SymbolKind) {
		return this.getSymbol(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id, kind);
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.returnValue) {
			this.returnValue.index(document, context);

			// For UC1 and UC2 we have to hardcode the "coerce" modifier for the Spawn's return type.
			if (this.getName() === NAME_SPAWN
				&& this.outer?.getName() === NAME_ACTOR
				&& this.outer.outer?.getName() === NAME_ENGINE) {
				this.returnValue.paramModifiers |= ParamModifiers.Coerce;
			}
		}

		super.index(document, context);

		if (context.super) {
			const overriddenMethod = context.super.findSuperSymbol(this.getName());
			if (overriddenMethod instanceof UCMethodSymbol) {
				document.indexReference(overriddenMethod, {
					location: Location.create(document.uri, this.id.range)
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
		if (this.returnValue) {
			text.push(this.returnValue.getTextForReturnValue());
		}
		text.push(this.getPath() + this.buildParameters());

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

	getRef(): ISymbol | undefined {
		return this.returnValue?.getType()?.getRef();
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
		// TODO: Perhaps only list operators with a custom Identifier? i.e. "Dot" and "Cross".
		return false;
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