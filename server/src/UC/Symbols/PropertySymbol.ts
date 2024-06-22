import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { config } from '../indexer';
import { UCGeneration } from '../settings';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextKind,
    Identifier,
    isConstSymbol,
    isEnumSymbol,
    isEnumTagSymbol,
    ISymbol,
    ITypeSymbol,
    UCArrayTypeSymbol,
    UCFieldSymbol,
    UCObjectSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
} from './';
import { ModifierFlags } from './ModifierFlags';

export class UCPropertySymbol extends UCFieldSymbol {
    override kind = UCSymbolKind.Property;

    // The type if specified, i.e. "var Object Outer;" Object here is represented by @type, including the resolved symbol.
    public type: ITypeSymbol;

    // The array dimension if specified, undefined if @arrayDimRef is truthy.
    public arrayDim?: number;

    // Array dimension is statically based on a declared symbol, such as a const or enum member.
    public arrayDimRef?: ITypeSymbol;
    public arrayDimRange?: Range;

    constructor(id: Identifier, range: Range, type: ITypeSymbol) {
        super(id, range);
        this.type = type;
    }

    isDynamicArray(): this is { type: UCArrayTypeSymbol } {
        return (this.type?.getTypeKind() === UCTypeKind.Array);
    }

    /**
     * Resolves and returns static array's size.
     * Returns undefined if unresolved.
     */
    getArrayDimSize(): number | undefined {
        if (this.arrayDimRef) {
            const symbol = this.arrayDimRef.getRef();
            if (!symbol) {
                return undefined;
            }

            if (isConstSymbol(symbol)) {
                const value = symbol.getComputedValue();
                return typeof value === 'number'
                    ? value
                    : undefined;
            }

            if (config.generation === UCGeneration.UC3) {
                if (isEnumSymbol(symbol)) {
                    return symbol.maxValue;
                }
                if (isEnumTagSymbol(symbol)) {
                    return symbol.value;
                }
            }
        }
        return this.arrayDim;
    }

    override getTypeKind() {
        return UCTypeKind.Object;
    }

    override getType() {
        return this.type;
    }

    protected override getTypeKeyword() {
        return 'var';
    }

    protected getTooltipId() {
        return this.getPath();
    }

    override buildModifiers(modifiers = this.modifiers): string[] {
        const text = super.buildModifiers(modifiers);

        if (modifiers & ModifierFlags.ReadOnly) {
            text.push('const');
        }

        return text;
    }

    override getTooltip() {
        const text: Array<string | undefined> = [];

        text.push(this.getTypeHint());
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

    override getContainedSymbolAtPos(position: Position) {
        return this.type?.getSymbolAtPos(position) ?? this.arrayDimRef?.getSymbolAtPos(position);
    }

    override getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: ContextKind, kinds?: UCSymbolKind): C[] {
        if (context === ContextKind.DOT) {
            const resolvedType = this.type?.getRef();
            if (resolvedType instanceof UCObjectSymbol) {
                return resolvedType.getCompletionSymbols<C>(document, context, kinds);
            }
        }
        // TODO: Filter by type only.
        else if (document.class) {
            return document.class.getCompletionSymbols<C>(document, context, kinds);
        }
        return [];
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        super.index(document, context);

        this.type?.index(document, context);
        this.arrayDimRef?.index(document, context);
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitProperty(this);
    }
}
