import { SymbolKind, CompletionItemKind, Position } from 'vscode-languageserver-types';

import { SymbolWalker } from '../symbolWalker';
import { IExpression } from '../expressions';
import { UCDocument } from '../document';
import { config, UCGeneration } from '../indexer';
import { SyntaxErrorNode, SemanticErrorNode } from '../diagnostics/diagnostics';
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

	public analyze(document: UCDocument, context: UCStructSymbol) {
		super.analyze(document, context);
		if (this.defaultExpression) {
			this.defaultExpression.analyze(document, context);
			if (config.generation !== UCGeneration.UC3) {
				document.nodes.push(new SyntaxErrorNode(this.getRange(), `Assigning a default value to a parameter, is only available as of UC3+!`));
			} else {
				if (!this.isOptional()) {
					document.nodes.push(new SemanticErrorNode(this, `To assign a default value to a parameter, it must be marked as 'optional'!`));
				}
			}
		}
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