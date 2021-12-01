import { CompletionItemKind, Position, Range, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { config, UCGeneration } from '../indexer';
import { NAME_ENUMCOUNT } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    ISymbol, ITypeSymbol, UCEnumMemberSymbol, UCEnumSymbol, UCFieldSymbol, UCStructSymbol, UCSymbol,
    UCTypeFlags
} from './';
import { isConstSymbol, resolveType, UCArrayTypeSymbol } from './TypeSymbol';

export class UCPropertySymbol extends UCFieldSymbol {
	// The type if specified, i.e. "var Object Outer;" Object here is represented by @type, including the resolved symbol.
	public type?: ITypeSymbol;

	// The array dimension if specified, undefined if @arrayDimRef is truthy.
	public arrayDim?: number;

	// Array dimension is statically based on a declared symbol, such as a const or enum member.
	public arrayDimRef?: ITypeSymbol;
	public arrayDimRange?: Range;

	isDynamicArray(): this is { type: UCArrayTypeSymbol } {
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
				if (isConstSymbol(symbol)) {
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
			const arrayDim = this.getArrayDimSize() ?? '';
			text.push(text.pop() + `[${arrayDim}]`);
		}

		return text.filter(s => s).join(' ');
	}

	getContainedSymbolAtPos(position: Position) {
		return this.type?.getSymbolAtPos(position) || this.arrayDimRef?.getSymbolAtPos(position);
	}

	getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: string, kind?: UCTypeFlags): C[] {
		if (context === '.') {
			const resolvedType = this.type?.getRef();
			if (resolvedType instanceof UCSymbol) {
				return resolvedType.getCompletionSymbols<C>(document, context, kind);
			}
		}
		// TODO: Filter by type only.
		else if (document.class) {
			return document.class.getCompletionSymbols<C>(document, context, kind);
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