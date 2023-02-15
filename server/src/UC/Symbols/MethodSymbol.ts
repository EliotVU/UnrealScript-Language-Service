import { Location, Position } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_ACTOR, NAME_ENGINE, NAME_SPAWN } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    ContextKind, DEFAULT_RANGE, isFunction, ISymbol, ModifierFlags, UCFieldSymbol, UCObjectSymbol,
    UCParamSymbol, UCStructSymbol, UCSymbolKind, UCTypeKind
} from './';

export enum MethodFlags {
    None = 0x0000,

    Function = 1 << 0,
    Operator = 1 << 1,
    PreOperator = 1 << 2,
    PostOperator = 1 << 3,
    Event = 1 << 4,
    Delegate = 1 << 5,
    Iterator = 1 << 6,

    // Implies Final
    Static = 1 << 7,
    Final = 1 << 8,

    OperatorKind = Operator | PreOperator | PostOperator,
    HasKind = Function | OperatorKind | Event | Delegate,

    NonOverridable = Final || PreOperator,
}

export class UCMethodSymbol extends UCStructSymbol {
    static readonly allowedKindsMask = 1 << UCSymbolKind.Const
        | 1 << UCSymbolKind.Property/** params and locals */;

    override kind = UCSymbolKind.Function;
	override modifiers = ModifierFlags.ReadOnly;

	public specifiers: MethodFlags = MethodFlags.None;

	public returnValue?: UCParamSymbol;
	public overriddenMethod?: UCMethodSymbol;

	public params?: UCParamSymbol[];

	/**
	 * Required count for a proper function call, this is exclusive of optional params.
	 * This value is initialized when analyze() is called on this symbol; remains undefined if no params.
	 */
	public requiredParamsCount?: number;

    hasAnySpecifierFlags(flags: MethodFlags): boolean {
        return (this.specifiers & flags) !== 0;
    }

    isDelegate(): this is UCDelegateSymbol {
        return (this.specifiers & MethodFlags.Delegate) !== 0;
    }

	isOperatorKind(): this is UCBaseOperatorSymbol {
        return (this.specifiers & MethodFlags.OperatorKind) !== 0;
	}

    /**
     * Returns true if this method is marked as a (binary) operator.
     * Beware that this returns false even when the method is a preoperator!
     */
    isBinaryOperator(): this is UCBinaryOperatorSymbol {
        return (this.specifiers & MethodFlags.Operator) !== 0;
    }

	isPreOperator(): this is UCPreOperatorSymbol {
		return (this.specifiers & MethodFlags.PreOperator) !== 0;
	}

	isPostOperator(): this is UCPostOperatorSymbol {
		return (this.specifiers & MethodFlags.PostOperator) !== 0;
	}

	override getTypeKind() {
		return UCTypeKind.Object;
	}

	override getType() {
		return this.returnValue?.getType();
	}

	override getDocumentation(): string | undefined {
		const doc = super.getDocumentation();
		if (doc) {
			return doc;
		}

		if (this.overriddenMethod) {
			return this.overriddenMethod.getDocumentation();
		}
	}

	override getContainedSymbolAtPos(position: Position) {
		return this.returnValue?.getSymbolAtPos(position) ?? super.getContainedSymbolAtPos(position);
	}

	override getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: ContextKind, kinds?: UCSymbolKind) {
		if (context === ContextKind.DOT) {
			const resolvedType = this.returnValue?.getType()?.getRef();
			if (resolvedType instanceof UCObjectSymbol) {
				return resolvedType.getCompletionSymbols<C>(document, context, kinds);
			}
		}

		const symbols: ISymbol[] = [];
        for (let child = this.children; child; child = child.next) {
			if (typeof kinds !== 'undefined' && ((1 << child.kind) & kinds) === 0) {
				continue;
			}
			if (child.acceptCompletion(document, this)) {
				symbols.push(child);
			}
		}

        const outerSymbols = this.outer.getCompletionSymbols<C>(document, context, kinds);
        if (outerSymbols) {
            return outerSymbols.concat(symbols as C[]);
        }
        return symbols as C[];
	}

	override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: UCSymbolKind) {
		return this.getSymbol<T>(id, kind) ?? (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
	}

	override index(document: UCDocument, context: UCStructSymbol) {
		if (this.returnValue) {
			this.returnValue.index(document, context);

			// For UC1 and UC2 we have to hardcode the "coerce" modifier for the Spawn's return type.
			if (this.getName() === NAME_SPAWN
				&& this.outer?.getName() === NAME_ACTOR
				&& this.outer.outer?.getName() === NAME_ENGINE) {
				this.returnValue.modifiers |= ModifierFlags.Coerce;
			}
		}
		super.index(document, context);
	}

    protected override indexSuper(document: UCDocument, context: UCStructSymbol) {
        if (context.super) {
			const symbolOverride = context.super.findSuperSymbol(this.getName());
			if (symbolOverride
                && isFunction(symbolOverride)
                // Never override a private method
                && !symbolOverride.hasAnyModifierFlags(ModifierFlags.Private)) {
				document.indexReference(symbolOverride, {
					location: Location.create(document.uri, this.id.range)
				});
				this.overriddenMethod = symbolOverride;
                this.super = symbolOverride;
			}
		}
    }

    protected override getTypeHint(): string | undefined {
        if (this.modifiers & ModifierFlags.Intrinsic) {
			return '(intrinsic)';
		}

		if (this.overriddenMethod) {
            return '(override)';
		}
    }

	protected override getTypeKeyword(): string {
		return 'function';
	}

    public buildTypeKeyword(): string {
        return this.getTypeKeyword();
    }

	override getTooltip(): string {
		const text: Array<string | undefined> = [];

		text.push(this.getTypeHint());
		const modifiers = this.buildModifiers();
        if (modifiers.length > 0) {
            text.push(modifiers.join(' '));
        }
		text.push(this.getTypeKeyword());
		if (this.returnValue) {
			text.push(this.returnValue.getTextForReturnValue());
		}
		text.push(this.getPath() + this.buildParameters());

		return text.filter(s => s).join(' ');
	}

	override buildModifiers(): string[] {
		const text = super.buildModifiers();

        if (this.specifiers & MethodFlags.Final) {
            text.push('final');
        }

		if (this.specifiers & MethodFlags.Static) {
			text.push('static');
		}

		return text;
	}

	public buildParameters(): string {
		return this.params
			? `(${this.params.map(f => f.getTextForSignature()).join(', ')})`
			: '()';
	}

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
		return visitor.visitMethod(this);
	}
}

/**
 * Pseudo method like Vect, Rot, and Rng
 * For those particular 'methods' we want to pass back the @returnValue as our symbol's type.
 */
export class UCMethodLikeSymbol extends UCMethodSymbol {
	override modifiers = ModifierFlags.ReadOnly | ModifierFlags.Intrinsic;
    override specifiers = MethodFlags.Static | MethodFlags.Final;

    constructor(name: Name) {
        super({ name, range: DEFAULT_RANGE });
    }

    override getTypeKind() {
        return UCTypeKind.Error;
    }
}

export class UCEventSymbol extends UCMethodSymbol {
    override kind = UCSymbolKind.Event;

	protected override getTypeKeyword(): string {
		return 'event';
	}
}

export class UCDelegateSymbol extends UCMethodSymbol {
    override kind = UCSymbolKind.Delegate;
	override modifiers = ModifierFlags.None;

    override getTypeKind() {
		return UCTypeKind.Delegate;
	}

	protected override getTypeKeyword(): string {
		return 'delegate';
	}
}

export abstract class UCBaseOperatorSymbol extends UCMethodSymbol {
    override kind = UCSymbolKind.Operator;

	override acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		// TODO: Perhaps only list operators with a custom Identifier? i.e. "Dot" and "Cross".
		return false;
	}
}

export class UCBinaryOperatorSymbol extends UCBaseOperatorSymbol {
	precedence?: number;

	protected override getTypeKeyword(): string {
		return `operator(${this.precedence})`;
	}
}

export class UCPreOperatorSymbol extends UCBaseOperatorSymbol {
	protected override getTypeKeyword(): string {
		return 'preoperator';
	}
}

export class UCPostOperatorSymbol extends UCBaseOperatorSymbol {
	protected override getTypeKeyword(): string {
		return 'postoperator';
	}
}

export function areMethodsCompatibleWith(a: UCMethodSymbol, b: UCMethodSymbol): boolean {
    // FIXME: Maybe check by hash instead of a memory-reference
    if (a === b) {
        return true;
    }

    if (a.returnValue && b.returnValue) {
        if (a.returnValue.getType()?.getTypeKind() !== b.returnValue.getType()?.getTypeKind()) {
            return false;
        }
    }

    if (a.params && b.params) {
        if (a.params.length !== b.params.length) {
            return false;
        }

        for (let i = 0; i < a.params.length; ++i) {
            if (a.params[i].getType()?.getTypeKind() === b.params[i].getType()?.getTypeKind()) {
                continue;
            }
            return false;
        }
    }
    return typeof a.params === typeof b.params && typeof a.returnValue === typeof b.returnValue;
}