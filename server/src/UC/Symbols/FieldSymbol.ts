import { Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { config, indexDeclarationReference } from '../indexer';
import { UCGeneration } from '../settings';
import { ISymbol, ITypeSymbol, UCObjectSymbol, UCStructSymbol, isParamSymbol } from './';

export enum ModifierFlags {
	None 				= 0x0000,

    // FieldFlags

    /** The field is marked as 'protected' */
	Protected 			= 1 << 0,

    /** The field is marked as 'private' */
	Private 			= 1 << 1,

	NotPublic 			= Protected | Private,

    /** The field is marked as 'native' or 'intrinsic' */
	Native 				= 1 << 2,

    /** The field is marked as 'const' or treated as readonly (for intrinsics) */
	ReadOnly 			= 1 << 3, // aka Const

    /** The field has a specified element size. e.g. `var int MyVar[2];` */
	WithDimension		= 1 << 4, // A multiple dimension property

    /** The field is marked as 'transient' */
    Transient           = 1 << 6,

    // ParamFlags

    /** The field is a parameter of a function. */
    Param               = 1 << 7,

    /** The field is a return parameter (generated) of a function. */
	ReturnParam			= 1 << 8,

    /** The field is marked as 'out' */
	Out 			    = 1 << 9,

    /** The field is marked as 'optional' */
	Optional		    = 1 << 10,

    /** The field is marked as 'init' */
	Init 			    = 1 << 11, // NOT SUPPORTED

    /** The field is marked as 'skip' */
	Skip			    = 1 << 12, // NOT SUPPORTED

    /** The field is marked as 'coerce' */
	Coerce			    = 1 << 13,

    // XCom

    /** The field is marked as 'ref' */
	Ref				    = 1 << 14, // NOT SUPPORTED

    // LocalFlags

    /** The field is a local field of a function or state. */
    Local	            = 1 << 15,

    // ClassFlags

    /** The field is marked as 'abstract' */
    Abstract            = 1 << 16, // TODO: Unify with ClassModifiers?

    // InternalFlags
    /**
     * Field is an intrisic symbol, not to be confused with the older 'intrinsic' native keyword.
     * That means the symbol was not contructed from an UnrealScript counter part or is not designed in a way that it ever could be.
     * For instance:
     *  - 'ArrayIterator' an iterator function symbol to deal with a `foreach` loop on a dynamic array.
     *  - 'IntrinsicVectLiteral' a function to represent a `vect(...)` literal.
     *  - 'Core.Class' a class with no UnrealScript counter part (a Class.uc file)
     **/
    Intrinsic           = 1 << 17,

    /** The field is a generated symbol, such as the return type of a function. */
    Generated           = 1 << 18,

    /** The field is a keyword symbol, such as `Vect` */
    Keyword             = 1 << 19,

    /** The field should not index a declaration reference. */
    NoDeclaration       = 1 << 20,

    /** The field is marked as 'deprecated' */
    Deprecated          = 1 << 21,

    // A private method can however be re-defined!
    NonOverridable      = Private | Intrinsic,
}

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
