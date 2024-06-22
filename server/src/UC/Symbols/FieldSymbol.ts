import { Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { config, indexDeclarationReference } from '../indexer';
import { UCGeneration } from '../settings';
import { ITypeSymbol, UCObjectSymbol, UCStructSymbol, isParamSymbol } from './';
import { ModifierFlags } from './ModifierFlags';

export abstract class UCFieldSymbol extends UCObjectSymbol {
    declare outer: UCObjectSymbol;

	public modifiers: ModifierFlags = ModifierFlags.None;
	public next?: UCFieldSymbol = undefined;

	getType(): ITypeSymbol | undefined {
		return undefined;
	}

	protected getTypeKeyword(): string | undefined {
		return undefined;
	}

    protected getTypeHint(): string | undefined {
        if (this.modifiers & ModifierFlags.Intrinsic) {
			return '(intrinsic)';
		}
        if (this.modifiers & ModifierFlags.Generated) {
            return '(generated)';
        }
        return undefined;
    }

	override getTooltip(): string {
		return this.getPath();
	}

	getCompletionContext(_position: Position): UCStructSymbol | undefined {
		return undefined;
	}

    hasAnyModifierFlags(flags: ModifierFlags): boolean {
        return (this.modifiers & flags) !== 0;
    }

    /**
	 * Returns true if this property is declared as a static array type (false if it's dynamic!).
	 * Note that this property will be seen as a static array even if the @arrayDim value is invalid.
	 */
	isFixedArray(): boolean {
		return (this.modifiers & ModifierFlags.WithDimension) === ModifierFlags.WithDimension;
	}

	override index(document: UCDocument, _context: UCStructSymbol) {
		if ((this.modifiers & ModifierFlags.NoDeclaration) == 0) indexDeclarationReference(this, document);
	}

	public buildModifiers(modifiers = this.modifiers): string[] {
		const text: string[] = [];

        // The modifiers below are not applicable to parameters.
        if (isParamSymbol(this)) {
            return text;
        }

        if (modifiers & ModifierFlags.Protected) {
            text.push('protected');
        } else if (modifiers & ModifierFlags.Private) {
            text.push('private');
        } else if (config.generation !== UCGeneration.UC1) {
            text.push('public');
        }

		if (modifiers & ModifierFlags.Native) {
			text.push('native');
		}

        if (modifiers & ModifierFlags.Transient) {
            text.push('transient');
        }

		return text;
	}
}
