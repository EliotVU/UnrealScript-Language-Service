import { SymbolKind, CompletionItemKind, Position, Range } from 'vscode-languageserver-types';

import * as UCParser from '../../antlr/UCGrammarParser';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { SemanticErrorNode, SemanticErrorRangeNode } from '../diagnostics/diagnostics';
import { DocumentASTWalker } from '../documentASTWalker';
import { rangeFromBound } from '../helpers';
import { NAME_ENUMCOUNT } from '../names';
import { config, UCGeneration } from '../indexer';

import {
	ITypeSymbol, UCTypeFlags,
	UCFieldSymbol, UCStructSymbol, UCEnumSymbol,
	UCEnumMemberSymbol, UCConstSymbol,
	PredefinedBool, NativeArray
} from '.';

export class UCPropertySymbol extends UCFieldSymbol {
	public type?: ITypeSymbol;

	// Array dimension if specified, string should consist of an integer.
	private arrayDim?: string;
	private arrayDimRange?: Range;

	// Array dimension is statically based on a declared symbol, such as a const or enum member.
	private arrayDimRef?: ITypeSymbol;

	/**
	 * Returns true if this property is declared as a static array type (false if it's is dynamic!).
	 * Note that this property will be seen as a static array even if the @arrayDim value is invalid.
	 */
	isFixedArray(): boolean {
		return !!this.arrayDimRef || Boolean(this.arrayDim);
	}

	isDynamicArray(): boolean {
		return (this.type && this.type.getReference()) === NativeArray;
	}

	/**
	 * Resolves and returns static array's size.
	 * Returns undefined if unresolved.
	 */
	getArrayDimSize(): number | undefined {
		const symbol = this.arrayDimRef && this.arrayDimRef.getReference();
		if (symbol) {
			if (symbol instanceof UCConstSymbol) {
				return symbol.getComputedValue();
			}

			if (config.generation === UCGeneration.UC3) {
				if (symbol instanceof UCEnumSymbol) {
					return (<UCEnumMemberSymbol>symbol.getSymbol(NAME_ENUMCOUNT)).value;
				}
				if (symbol instanceof UCEnumMemberSymbol) {
					return symbol.value;
				}
			}
		} else if (this.arrayDim) {
			return Number(this.arrayDim);
		}
		return undefined;
	}

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getTypeFlags() {
		return this.type ? this.type.getTypeFlags() : UCTypeFlags.Error;
	}

	getType() {
		return this.type;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	protected getTypeKeyword() {
		return 'var';
	}

	protected getTooltipId() {
		return this.getQualifiedName();
	}

	getTooltip() {
		const text: Array<string | undefined> = [];

		text.push(this.getTypeKeyword());

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

		text.push(this.type!.getTypeText());
		text.push(this.getTooltipId());

		if (this.isFixedArray()) {
			// We want to avoid printing out 'undefined', so always fall back to 0 instead.
			const arrayDim = this.getArrayDimSize() || 0;
			text.push(text.pop() + `[${arrayDim}]`);
		}

		return text.filter(s => s).join(' ');
	}

	getContainedSymbolAtPos(position: Position) {
		const symbol = this.type && this.type.getSymbolAtPos(position);
		return symbol || this.arrayDimRef && this.arrayDimRef.getSymbolAtPos(position);
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		this.type && this.type.index(document, context);
		this.arrayDimRef && this.arrayDimRef.index(document, context);
	}

	public analyze(document: UCDocument, context: UCStructSymbol) {
		this.type && this.type.analyze(document, context);

		if (this.isFixedArray()) {
			if (this.arrayDimRef) {
				this.arrayDimRef.analyze(document, context);
			}

			const arraySize = this.getArrayDimSize();
			if (!arraySize) {
				document.nodes.push(new SemanticErrorRangeNode(this.arrayDimRange!, `Bad array size, try refer to a type that can be evaulated to an integer!`));
			} else if (arraySize > 2048 || arraySize <= 1) {
				document.nodes.push(new SemanticErrorRangeNode(this.arrayDimRange!, `Illegal array size, must be between 2-2048`));
			}

			const arrayType = this.type && this.type.getReference();
			if (arrayType === PredefinedBool || arrayType === NativeArray) {
				document.nodes.push(new SemanticErrorNode(this.type!, `Illegal array type '${this.type!.getTypeText()}'`));
			}
		}

		if (this.isDynamicArray()) {
			// TODO: check valid types, and also check if we are a static array!
			// TODO: Should define a custom type class for arrays, so that we can analyze it right there.
		}
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitProperty(this);
	}

	walk(visitor: DocumentASTWalker, ctx: UCParser.VariableContext) {
		const arrayDimNode = ctx._arrayDim;
		if (!arrayDimNode) {
			return;
		}

		const qualifiedNode = arrayDimNode.qualifiedIdentifier();
		if (qualifiedNode) {
			this.arrayDimRef = qualifiedNode.accept(visitor);
			this.arrayDimRange = this.arrayDimRef && this.arrayDimRef.getRange();
			return;
		}

		const intNode = arrayDimNode.INTEGER();
		if (intNode) {
			this.arrayDim = intNode.text;
			this.arrayDimRange = rangeFromBound(intNode.symbol);
		}
	}
}