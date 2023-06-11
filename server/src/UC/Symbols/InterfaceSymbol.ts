import { SymbolWalker } from '../symbolWalker';
import { ClassModifierFlags, UCClassSymbol, UCSymbolKind, UCTypeKind } from './';

export class UCInterfaceSymbol extends UCClassSymbol {
    static override readonly allowedKindsMask = 1 << UCSymbolKind.Enum
        | 1 << UCSymbolKind.ScriptStruct
        | 1 << UCSymbolKind.Property
        | 1 << UCSymbolKind.Function;

    override kind = UCSymbolKind.Interface;
    override classModifiers = ClassModifierFlags.Interface;

    override getTypeKind(): UCTypeKind {
        return UCTypeKind.Interface;
    }

    protected override getTypeKeyword(): string | undefined {
        return 'interface';
    }

    override accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitInterface(this);
    }
}
