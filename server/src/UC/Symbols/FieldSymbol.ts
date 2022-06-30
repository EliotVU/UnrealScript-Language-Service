import { Position, Range } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { intersectsWith, intersectsWithRange } from '../helpers';
import { indexDeclarationReference } from '../indexer';
import { Identifier, ISymbol, ITypeSymbol, UCObjectSymbol, UCStructSymbol } from './';

export enum ModifierFlags {
	None 				= 0x0000,

    // PropertyFlags
	Protected 			= 1 << 0,
	Private 			= 1 << 1,
	NotPublic 			= Protected | Private,
	Native 				= 1 << 2,
	ReadOnly 			= 1 << 3, // aka Const
	WithDimension		= 1 << 4, // A multiple dimension property
    Transient           = 1 << 6,

    // ParamFlags
    Param               = 1 << 7,
	ReturnParam			= 1 << 8,
	Out 			    = 1 << 9,
	Optional		    = 1 << 10,
	Init 			    = 1 << 11, // NOT SUPPORTED
	Skip			    = 1 << 12, // NOT SUPPORTED
	Coerce			    = 1 << 13,
    // XCom
	Ref				    = 1 << 14, // NOT SUPPORTED

    // LocalFlags
    Local	            = 1 << 15,

    // ClassFlags
    Abstract            = 1 << 16,

    // InternalFlags
    // Not to be confused with the alternative keyword of "Native"
    Intrinsic           = 1 << 17,
    Generated           = 1 << 18,
    Keyword             = 1 << 19,
    NoDeclaration       = 1 << 20,
}

export abstract class UCFieldSymbol extends UCObjectSymbol {
    declare outer: UCObjectSymbol;

	public modifiers: ModifierFlags = ModifierFlags.None;
	public next?: UCFieldSymbol = undefined;

	constructor(id: Identifier, private readonly range: Range = id.range) {
		super(id);
	}

	override getRange(): Range {
		return this.range;
	}

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

	override getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}

		if (intersectsWithRange(position, this.id.range)) {
			return this;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getCompletionContext(_position: Position): ISymbol | undefined {
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

	override acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		return true;
	}

	override index(document: UCDocument, _context: UCStructSymbol) {
		if ((this.modifiers & ModifierFlags.NoDeclaration) == 0) indexDeclarationReference(this, document);
	}

	public buildModifiers(modifiers = this.modifiers): string[] {
		const text: string[] = [];

		if (modifiers & ModifierFlags.Native) {
			text.push('native');
		}

        if (modifiers & ModifierFlags.Transient) {
            text.push('transient');
        }

		if (modifiers & ModifierFlags.Protected) {
			text.push('protected');
		}
		else if (modifiers & ModifierFlags.Private) {
			text.push('private');
		}

		return text;
	}
}