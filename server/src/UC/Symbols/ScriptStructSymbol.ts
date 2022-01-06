import { CompletionItemKind, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { SymbolWalker } from '../symbolWalker';
import {
    ISymbol, UCMethodSymbol, UCPropertySymbol, UCStructSymbol, UCSymbol, UCTypeFlags
} from './';
import { ModifierFlags } from './FieldSymbol';

export class UCScriptStructSymbol extends UCStructSymbol {
    static readonly AllowedTypesMask = UCTypeFlags.Const
        | UCTypeFlags.Struct
        | UCTypeFlags.Property;

    override modifiers = ModifierFlags.ReadOnly;

	override getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	override getTypeFlags() {
		return UCTypeFlags.Struct;
	}

	override getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Struct;
	}

    protected override getTypeKeyword(): string | undefined {
		return 'struct';
	}

	override getTooltip(): string {
        const text: Array<string | undefined> = [];
		text.push(this.getTypeHint());
        text.push(this.getTypeKeyword());
        const modifiers = this.buildModifiers();
        if (modifiers.length > 0) {
            text.push(modifiers.join(' '));
        }
        text.push(this.getPath());
        if (this.super) {
            text.push(`extends ${this.super.getPath()}`);
        }
		return text.filter(Boolean).join(' ');
	}

    override buildModifiers(modifiers = this.modifiers): string[] {
		const text: string[] = [];

		if (modifiers & ModifierFlags.Native) {
			text.push('native');
		}

        if (modifiers & ModifierFlags.Transient) {
            text.push('transient');
        }

		return text;
	}

    override getCompletionSymbols<C extends ISymbol>(document: UCDocument, _context: string, type?: UCTypeFlags) {
		const symbols: ISymbol[] = [];
		for (let child = this.children; child; child = child.next) {
			if (typeof type !== 'undefined' && (child.getTypeFlags() & type) === 0) {
				continue;
			}
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}

		for (let parent = this.super; parent; parent = parent.super) {
            if ((parent.getTypeFlags() & UCTypeFlags.Struct) === 0) {
                break;
            }

			for (let child = parent.children; child; child = child.next) {
				if (typeof type !== 'undefined' && (child.getTypeFlags() & type) === 0) {
					continue;
				}
				if (child.acceptCompletion(document, this)) {
					symbols.push(child);
				}
			}
		}
		return symbols as C[];
	}

	override acceptCompletion(_document: UCDocument, context: UCSymbol): boolean {
		return (context instanceof UCPropertySymbol || context instanceof UCMethodSymbol);
	}

	override index(document: UCDocument, _context: UCStructSymbol) {
		super.index(document, this);
	}

	override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitScriptStruct(this);
	}
}