import { Token } from 'antlr4ts';
import {
    CompletionItemKind, Position, Range, SymbolInformation, SymbolKind
} from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWithRange } from '../helpers';
import { Name } from '../name';
import { SymbolWalker } from '../symbolWalker';
import { getSymbolPathHash, Identifier, ISymbol, UCStructSymbol, UCTypeFlags } from './';

export const DEFAULT_POSITION = Position.create(0, 0);
export const DEFAULT_RANGE = Range.create(DEFAULT_POSITION, DEFAULT_POSITION);

/**
 * A symbol built from an AST context.
 */
export abstract class UCSymbol implements ISymbol {
	public outer?: ISymbol;
	public description?: Token[];

    // TODO: Clarify id
	constructor(public readonly id: Identifier) {

	}

	/**
	 * Returns the whole range this symbol encompasses i.e. for a struct this should be inclusive of the entire block.
	 */
	getRange(): Range {
		return this.id.range;
	}

    getName(): Name {
		return this.id.name;
	}

    // Particular use case to index symbol references by outer.
	getHash(): number {
		return getSymbolPathHash(this);
	}

	getPath(): string {
        const names: string[] = [this.id.name.text];
		for (let outer = this.outer; outer; outer = outer.outer) {
            names.unshift(outer.id.name.text);
		}
		return names.join('.');
	}

	getKind(): SymbolKind {
		return SymbolKind.Field;
	}

	getTypeFlags() {
		return UCTypeFlags.Error;
	}

	/** Returns a tooltip for this symbol, usually mirroring the written code, but minimalized and formatted. */
	getTooltip(): string {
		return this.getPath();
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Text;
	}

	getSymbolAtPos(position: Position): ISymbol | undefined {
		return intersectsWithRange(position, this.getRange()) && this.getContainedSymbolAtPos(position) || this;
	}

	protected getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
		return undefined;
	}

	// TODO: Refactor ISymbol to CompletionItem.
	getCompletionSymbols<C extends ISymbol>(_document: UCDocument, _context: string, _kind?: UCTypeFlags): C[] {
		return [];
	}

	acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		return true;
	}

	index(_document: UCDocument, _context: UCStructSymbol) {
        //
    }

	getUri(): string {
		return this.outer instanceof UCSymbol && this.outer.getUri() || '';
	}

	getDocumentation(): string | undefined {
		return this.description?.map(t => t.text!).join('\n');
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(
			this.getName().text, this.getKind(),
			this.getRange(), undefined,
			this.outer?.getName().text
		);
	}

	accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visit(this);
	}

    toString(): string {
        return this.getPath();
    }
}