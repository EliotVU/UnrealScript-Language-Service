import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { IExpression } from '../expressions';
import { UCDocument } from '../document';
import { UCPropertySymbol, UCStructSymbol } from '.';

export enum ParamModifiers {
	None 			= 0x0000,
	Out 			= 0x0001,
	Optional		= 0x0002,
	Init 			= 0x0004, // NOT SUPPORTED
	Skip			= 0x0008, // NOT SUPPORTED
	Coerce			= 0x0010
	// const is available as a @FieldModifier
}

export class UCParamSymbol extends UCPropertySymbol {
	public paramModifiers: ParamModifiers = ParamModifiers.None;

	defaultExpression?: IExpression;

	isPrivate(): boolean {
		return true;
	}

	isOptional(): boolean {
		return (this.paramModifiers & ParamModifiers.Optional) !== 0;
	}

	isCoerced(): boolean {
		return (this.paramModifiers & ParamModifiers.Coerce) !== 0;
	}

	isOut(): boolean {
		return (this.paramModifiers & ParamModifiers.Out) !== 0;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTextForSignature(): string {
		const text: Array<string | undefined> = [];

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		if (this.type) {
			text.push(this.type.getTypeText());
		}
		text.push(this.getId().toString());

		return text.filter(s => s).join(' ');
	}

	protected getTypeKeyword(): string {
		return '(parameter)';
	}

	protected getTooltipId(): string {
		return this.getId().toString();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.defaultExpression && this.defaultExpression.getSymbolAtPos(position);
		return symbol || super.getContainedSymbolAtPos(position);
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);
		this.defaultExpression && this.defaultExpression.index(document, context);
	}

	protected buildModifiers(): string[] {
		const text: string[] = [];

		if (this.isOptional()) {
			text.push('optional');
		}

		if (this.isOut()) {
			text.push('out');
		}

		if (this.isCoerced()) {
			text.push('coerce');
		}

		if (this.isConst()) {
			text.push('const');
		}

		return text;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitParameter(this);
	}
}