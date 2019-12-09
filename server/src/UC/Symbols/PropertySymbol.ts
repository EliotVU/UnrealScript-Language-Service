import { SymbolKind, CompletionItemKind, Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import { NAME_ENUMCOUNT } from '../names';
import { config, UCGeneration } from '../indexer';

import {
	ITypeSymbol, UCTypeFlags,
	UCFieldSymbol, UCStructSymbol,
	UCEnumSymbol, UCEnumMemberSymbol,
	UCConstSymbol, ISymbol, UCSymbol
} from '.';
import { resolveType } from './TypeSymbol';
import { FieldModifiers } from './FieldSymbol';

export class UCPropertySymbol extends UCFieldSymbol {
	// The type if specified, i.e. "var Object Outer;" Object here is represented by @type, including the resolved symbol.
	public type?: ITypeSymbol;

	// The array dimension if specified, undefined if @arrayDimRef is truthy.
	public arrayDim?: number;

	// Array dimension is statically based on a declared symbol, such as a const or enum member.
	public arrayDimRef?: ITypeSymbol;
	public arrayDimRange?: Range;

	/**
	 * Returns true if this property is declared as a static array type (false if it's is dynamic!).
	 * Note that this property will be seen as a static array even if the @arrayDim value is invalid.
	 */
	isFixedArray(): boolean {
		return (this.modifiers & FieldModifiers.WithDimension) !== 0;
	}

	isDynamicArray(): boolean {
		return (this.type?.getTypeFlags() === UCTypeFlags.Array);
	}

	/**
	 * Resolves and returns static array's size.
	 * Returns undefined if unresolved.
	 */
	getArrayDimSize(): number | undefined {
		if (this.arrayDimRef) {
			const symbol = this.arrayDimRef.getRef();
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
			}
			return undefined;
		}
		return this.arrayDim;
	}

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getTypeFlags() {
		return UCTypeFlags.Property;
	}

	getType() {
		return resolveType(this.type);
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	protected getTypeKeyword() {
		return 'var';
	}

	protected getTooltipId() {
		return this.getPath();
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
		const symbol = this.type?.getSymbolAtPos(position) || this.arrayDimRef?.getSymbolAtPos(position);
		return symbol;
	}

	getCompletionSymbols(document: UCDocument, context: string): ISymbol[] {
		if (context === '.') {
			const resolvedType = this.type?.getRef();
			if (resolvedType instanceof UCSymbol) {
				return resolvedType.getCompletionSymbols(document, context);
			}
		}
		// TODO: Filter by type only.
		else if (document.class) {
			return document.class.getCompletionSymbols(document, context);
		}
		return [];
	}

	public index(document: UCDocument, context: UCStructSymbol) {
		super.index(document, context);

		this.type?.index(document, context);
		this.arrayDimRef?.index(document, context);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result {
		return visitor.visitProperty(this);
	}
}