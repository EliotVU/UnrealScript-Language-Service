import { CompletionItemKind, Location, Position, SymbolKind } from 'vscode-languageserver-types';

import { UCDocument } from '../document';
import { Name } from '../name';
import { NAME_ACTOR, NAME_ENGINE, NAME_SPAWN } from '../names';
import { SymbolWalker } from '../symbolWalker';
import {
    DEFAULT_RANGE, isMethodSymbol, ISymbol, IWithReference, ModifierFlags, UCFieldSymbol,
    UCParamSymbol, UCStructSymbol, UCSymbol, UCTypeFlags
} from './';

export enum MethodFlags {
	None 			= 0x0000,

	Function 		= 1 << 0,
	Operator 		= 1 << 1,
	PreOperator 	= 1 << 2,
	PostOperator 	= 1 << 3,
	Event 			= 1 << 4,
	Delegate 		= 1 << 5,
	Static 			= 1 << 6,
	Final 			= 1 << 7,

	OperatorKind 	= Operator | PreOperator | PostOperator,
	HasKind			= Function | OperatorKind | Event | Delegate
}

export class UCMethodSymbol extends UCStructSymbol {
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

	/**
	 * Returns true if this method is marked as a (binary) operator.
	 * Beware that this returns false even when the method is a preoperator!
	 */
	isOperator(): this is UCBinaryOperatorSymbol {
		return (this.specifiers & MethodFlags.Operator) !== 0;
	}

	isOperatorKind(): this is UCBaseOperatorSymbol {
		return (this.specifiers & MethodFlags.OperatorKind) !== 0;
	}

	isPreOperator(): this is UCPreOperatorSymbol {
		return (this.specifiers & MethodFlags.PreOperator) !== 0;
	}

	isPostOperator(): this is UCPostOperatorSymbol {
		return (this.specifiers & MethodFlags.PostOperator) !== 0;
	}

	override getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	override getTypeFlags() {
		return UCTypeFlags.Function;
	}

	override getType() {
		return this.returnValue?.getType();
	}

	override getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
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

	override getCompletionSymbols<C extends ISymbol>(document: UCDocument, context: string, kind?: UCTypeFlags) {
		if (context === '.') {
			const resolvedType = this.returnValue?.getType()?.getRef();
			if (resolvedType instanceof UCSymbol) {
				return resolvedType.getCompletionSymbols<C>(document, context, kind);
			}
		}
		return super.getCompletionSymbols<C>(document, context, kind);
	}

	override findSuperSymbol<T extends UCFieldSymbol>(id: Name, kind?: SymbolKind) {
		return this.getSymbol<T>(id, kind) || (<UCStructSymbol>(this.outer)).findSuperSymbol<T>(id, kind);
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

		if (context.super) {
			const overriddenMethod = context.super.findSuperSymbol(this.getName());
			if (overriddenMethod && isMethodSymbol(overriddenMethod)) {
				document.indexReference(overriddenMethod, {
					location: Location.create(document.uri, this.id.range)
				});
				this.overriddenMethod = overriddenMethod;
			}
		}
	}

	protected override getTypeKeyword(): string {
		return 'function';
	}

	override getTooltip(): string {
		const text: Array<string | undefined> = [];

		if (this.overriddenMethod) {
			text.push('(override)');
		}

		const modifiers = this.buildModifiers();
		text.push(...modifiers);

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

	protected buildParameters(): string {
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
export class UCMethodLikeSymbol extends UCMethodSymbol implements IWithReference {
	modifiers = ModifierFlags.ReadOnly | ModifierFlags.Intrinsic;
    specifiers = MethodFlags.Static | MethodFlags.Final;

	constructor(name: Name, protected kind?: string) {
		super({ name, range: DEFAULT_RANGE });
	}

    getTypeFlags() {
		return this.returnValue?.getTypeFlags() ?? UCTypeFlags.Error;
	}

	protected getTypeKeyword(): string {
		return '(intrinsic)';
	}

	getRef<T extends ISymbol>(): T | undefined {
		return this.returnValue?.getType()?.getRef<T>();
	}
}

export class UCEventSymbol extends UCMethodSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Event;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Event;
	}

	protected getTypeKeyword(): string {
		return 'event';
	}
}

export class UCDelegateSymbol extends UCMethodSymbol {
	modifiers = ModifierFlags.None;

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

    getTypeFlags() {
		return UCTypeFlags.Function | UCTypeFlags.Delegate;
	}

	protected getTypeKeyword(): string {
		return 'delegate';
	}
}

export abstract class UCBaseOperatorSymbol extends UCMethodSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Operator;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Operator;
	}

	acceptCompletion(document: UCDocument, context: ISymbol): boolean {
		// TODO: Perhaps only list operators with a custom Identifier? i.e. "Dot" and "Cross".
		return false;
	}
}

export class UCBinaryOperatorSymbol extends UCBaseOperatorSymbol {
	precedence?: number;

	protected getTypeKeyword(): string {
		return `operator(${this.precedence})`;
	}
}

export class UCPreOperatorSymbol extends UCBaseOperatorSymbol {
	protected getTypeKeyword(): string {
		return 'preoperator';
	}
}

export class UCPostOperatorSymbol extends UCBaseOperatorSymbol {
	protected getTypeKeyword(): string {
		return 'postoperator';
	}
}

export function areMethodsCompatibleWith(a: UCMethodSymbol, b: UCMethodSymbol): boolean {
    // FIXME: Maybe check by hash instead of a memory-reference
    if (a === b) {
        return true;
    }

    if (a.returnValue && b.returnValue) {
        if (a.returnValue.getType()?.getTypeFlags() !== b.returnValue.getType()?.getTypeFlags()) {
            return false;
        }
    }

    if (a.params && b.params) {
        if (a.params.length !== b.params.length) {
            return false;
        }

        for (let i = 0; i < a.params.length; ++i) {
            if (a.params[i].getType()?.getTypeFlags() === b.params[i].getType()?.getTypeFlags()) {
                continue;
            }
            return false;
        }
    }
    return typeof a.params === typeof b.params && typeof a.returnValue === typeof b.returnValue;
}