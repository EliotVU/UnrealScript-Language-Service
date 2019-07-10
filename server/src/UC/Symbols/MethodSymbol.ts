import { SymbolKind, CompletionItemKind, Position, Location } from 'vscode-languageserver-types';

import { getDocumentByUri } from '../indexer';
import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { Name } from '../names';
import { SemanticErrorNode } from '../diagnostics/diagnostics';

import { DEFAULT_RANGE, UCStructSymbol, UCParamSymbol, ITypeSymbol, ISymbol, IWithReference, UCTypeFlags } from '.';

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

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getTypeFlags() {
		return UCTypeFlags.Function;
	}

	getType() {
		return this.returnType;
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

	getContainedSymbolAtPos(position: Position) {
		if (this.returnType) {
			const returnSymbol = this.returnType.getSymbolAtPos(position);
			if (returnSymbol) {
				return returnSymbol;
			}
		}
		return super.getContainedSymbolAtPos(position);
	}

	findSuperSymbol(id: Name) {
		return this.getSymbol(id) || (<UCStructSymbol>(this.outer)).findSuperSymbol(id);
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

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.returnType) {
			this.returnType.analyze(document, context);
		}

		if (this.params) {
			for (var requiredParamsCount = 0; requiredParamsCount < this.params.length; ++ requiredParamsCount) {
				if (this.params[requiredParamsCount].isOptional()) {
					// All trailing params after the first optional param, are required to be declared as 'optional' too.
					for (let i = requiredParamsCount + 1; i < this.params.length; ++ i) {
						const param = this.params[i];
						if (param.isOptional()) {
							continue;
						}

						document.nodes.push(new SemanticErrorNode(
							param,
							`Parameter '${param.getId()}' must be marked 'optional' after an optional parameter.`
						));
					}
					break;
				}
			}
			this.requiredParamsCount = requiredParamsCount;
		}

		super.analyze(document, context);

		if (this.overriddenMethod) {
			// TODO: check difference
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

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (!this.isFinal()) {
			document.nodes.push(new SemanticErrorNode(this, `Operator must be declared as 'final'.`));
		}
	}
}

export class UCBinaryOperatorSymbol extends UCBaseOperatorSymbol {
	precedence?: number;

	protected getTypeKeyword(): string {
		return `operator(${this.precedence})`;
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (!this.precedence) {
			document.nodes.push(new SemanticErrorNode(this, `Operator must have a precedence.`));
		} else if (this.precedence < 0 || this.precedence > 255) {
			document.nodes.push(new SemanticErrorNode(this, `Operator precedence must be between 0-255.`));
		}
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