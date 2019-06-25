import { SymbolKind, CompletionItemKind, Position, Range } from 'vscode-languageserver-types';

import * as UCParser from '../../antlr/UCGrammarParser';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { SemanticErrorNode, SemanticErrorRangeNode } from '../diagnostics/diagnostics';
import { DocumentASTWalker } from '../documentASTWalker';
import { rangeFromBound } from '../helpers';

import { ITypeSymbol, UCFieldSymbol, UCStructSymbol, UCEnumMemberSymbol, UCConstSymbol, PredefinedBool, NativeArray } from '.';

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
			if (symbol instanceof UCEnumMemberSymbol) {
				return symbol.value;
			} else if (symbol instanceof UCConstSymbol) {
				// FIXME: Need to parse const values, and then adapt this line of code to reflect that change.
				// As of now this makes a naive assumption that any const consists of a raw number.
				return Number(symbol.value);
			}
		} else if (this.arrayDim) {
			return Number(this.arrayDim);
		}
		return undefined;
	}

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTypeTooltip() {
		return 'var';
	}

	getTooltip() {
		const text = `${this.getTypeTooltip()} ${this.type!.getTypeText()} ${this.getQualifiedName()}`;
		if (this.isFixedArray()) {
			return text + `[${this.getArrayDimSize()}]`;
		}
		return text;
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

				const symbol = this.arrayDimRef.getReference();
				if (symbol && !(symbol instanceof UCEnumMemberSymbol || symbol instanceof UCConstSymbol)) {
					document.nodes.push(new SemanticErrorNode(this.arrayDimRef, `'${symbol.getQualifiedName()}' is not a const or enum member`));
				}
			}

			const arraySize = this.getArrayDimSize();
			if (typeof arraySize !== 'undefined' && (arraySize > 255 || arraySize <= 0)) {
				document.nodes.push(new SemanticErrorRangeNode(this.arrayDimRange!, `Array's size must be between 1-255`));
			}

			const arrayType = this.type && this.type.getReference();
			if (arrayType === PredefinedBool || arrayType === NativeArray) {
				document.nodes.push(new SemanticErrorNode(this.type!, `Invalid type '${this.type!.getTypeText()}' for a static array variable`));
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
		const arrayDimNode = ctx.arrayDim();
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