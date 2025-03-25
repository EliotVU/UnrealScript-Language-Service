import type { UCDocument } from "./document";
import type {
    ISymbol,
    UCArchetypeSymbol,
    UCArrayTypeSymbol,
    UCClassSymbol,
    UCConstSymbol,
    UCDefaultPropertiesBlock,
    UCDelegateTypeSymbol,
    UCEnumMemberSymbol,
    UCEnumSymbol,
    UCInterfaceSymbol,
    UCLocalSymbol,
    UCMapTypeSymbol,
    UCMethodSymbol,
    UCObjectTypeSymbol,
    UCPackage,
    UCParamSymbol,
    UCPropertySymbol,
    UCQualifiedTypeSymbol,
    UCReplicationBlock,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCTypeSymbol,
} from "./Symbols";
import { DumbSymbolWalker } from "./symbolWalker";

// TODO: placeholder, move all tooltip implementations to the appropriate visit method
function visitSymbol(symbol: ISymbol): string {
    return symbol.getTooltip();
}

/**
 * A visitor to build a markdown tooltip for any particular symbol.
 */
export class SymbolTooltipBuilder extends DumbSymbolWalker<string> {
    override visitDocument(document: UCDocument): string {
        return "";
    }

    override visitPackage(symbol: UCPackage): string {
        return visitSymbol(symbol);
    }

    override visitType(symbol: UCTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitQualifiedType(symbol: UCQualifiedTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitObjectType(symbol: UCObjectTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitMapType(symbol: UCMapTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitDelegateType(symbol: UCDelegateTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitArrayType(symbol: UCArrayTypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visitInterface(symbol: UCInterfaceSymbol): string {
        return visitSymbol(symbol);
    }

    override visitClass(symbol: UCClassSymbol): string {
        return visitSymbol(symbol);
    }

    override visitConst(symbol: UCConstSymbol): string {
        return visitSymbol(symbol);
    }

    override visitEnum(symbol: UCEnumSymbol): string {
        return visitSymbol(symbol);
    }

    override visitEnumMember(symbol: UCEnumMemberSymbol): string {
        return visitSymbol(symbol);
    }

    override visitStruct(symbol: UCStructSymbol): string {
        return visitSymbol(symbol);
    }

    override visitScriptStruct(symbol: UCScriptStructSymbol): string {
        return visitSymbol(symbol);
    }

    override visitProperty(symbol: UCPropertySymbol): string {
        return visitSymbol(symbol);
    }

    override visitMethod(symbol: UCMethodSymbol): string {
        return visitSymbol(symbol);
    }

    override visitParameter(symbol: UCParamSymbol): string {
        return visitSymbol(symbol);
    }

    override visitLocal(symbol: UCLocalSymbol): string {
        return visitSymbol(symbol);
    }

    override visitState(symbol: UCStateSymbol): string {
        return visitSymbol(symbol);
    }

    override visitReplicationBlock(symbol: UCReplicationBlock): string {
        return visitSymbol(symbol);
    }

    override visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): string {
        return visitSymbol(symbol);
    }

    override visitArchetypeSymbol(symbol: UCArchetypeSymbol): string {
        return visitSymbol(symbol);
    }

    override visit(symbol: ISymbol): string {
        return visitSymbol(symbol);
    }
}
