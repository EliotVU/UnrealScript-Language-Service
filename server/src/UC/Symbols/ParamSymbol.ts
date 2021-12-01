import { CompletionItemKind, Position, SymbolKind } from 'vscode-languageserver-types';

import { IExpression } from '../expressions';
import { SymbolWalker } from '../symbolWalker';
import { UCPropertySymbol } from './';

// "const" is available as a @FieldModifier
export enum ParamModifiers {
	None 			= 0x0000,
	Out 			= 0x0001,
	Optional		= 0x0002,
	Init 			= 0x0004, // NOT SUPPORTED
	Skip			= 0x0008, // NOT SUPPORTED
	Coerce			= 0x0010,
	Return			= 0x0020,
	Ref				= 0x0040, // NOT SUPPORTED

	ReturnParam 	= Out | Return
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

	isRef(): boolean {
		return (this.paramModifiers & ParamModifiers.Ref) !== 0;
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
		text.push(this.getName().toString());

		return text.filter(s => s).join(' ');
	}

	getTextForReturnValue(): string {
		const text: Array<string | undefined> = [];
		if (this.isCoerced()) {
			text.push('coerce');
		}
		if (this.type) {
			text.push(this.type.getTypeText());
		}
		return text.filter(s => s).join(' ');
	}

	protected getTypeKeyword(): string {
		return '(parameter)';
	}

	protected getTooltipId(): string {
		return this.getName().toString();
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.defaultExpression?.getSymbolAtPos(position) || super.getContainedSymbolAtPos(position);
		return symbol;
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

		if (this.isReadOnly()) {
			text.push('const');
		}

		if (this.isRef()) {
			text.push('ref');
		}

		return text;
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitParameter(this);
	}
}