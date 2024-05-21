import { UCDocument } from './document';
import { UCArchetypeBlockStatement } from './statements';
import {
    ContextInfo,
    isParamSymbol,
    isStruct,
    UCArchetypeSymbol,
    UCClassSymbol,
    UCDefaultPropertiesBlock,
    UCEnumSymbol,
    UCMethodSymbol,
    UCParamSymbol,
    UCReplicationBlock,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
} from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

/**
 * First pass:
 * Will initiate the indexing of all symbols, but skip all code blocks (like UCBlock and UCStatement derivatives).
 */
export class DocumentSymbolIndexer extends DefaultSymbolWalker<undefined> {
    constructor(private document: UCDocument) {
        super();
    }

    override visitStructBase(symbol: UCStructSymbol) {
        for (let child = symbol.children; child; child = child.next) {
            if (isStruct(child)) {
                child.accept(this);
            }
        }
    }

    override visitClass(symbol: UCClassSymbol) {
        this.visitStructBase(symbol);

        // TODO: Re-factor all index code into DocumentSymbolIndexer
        symbol.index(this.document, symbol);
    }

    override visitParameter(symbol: UCParamSymbol) {
        this.visitProperty(symbol);
    }

    override visitReplicationBlock(symbol: UCReplicationBlock) {
        return;
    }

    override visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock): void {
        return;
    }

    override visitArchetypeSymbol(symbol: UCArchetypeSymbol): void {
        return;
    }

    override visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement): void {
        return;
    }
}

/**
 * Second pass:
 * Will initiate the indexing of all struct symbols that contain a block.
 * The indexing of a block is handled separately here so that we can resolve recursive dependencies within blocks.
 */
export class DocumentCodeIndexer extends DefaultSymbolWalker<undefined> {
    constructor(private document: UCDocument) {
        super();
    }

    override visitStructBase(symbol: UCStructSymbol) {
        for (let child = symbol.children; child; child = child.next) {
            if (isStruct(child)) {
                child.accept(this);
            }
        }
    }

    override visitEnum(_symbol: UCEnumSymbol) { return; }
    override visitScriptStruct(symbol: UCScriptStructSymbol) {
        this.visitStructBase(symbol);
    }

    override visitClass(symbol: UCClassSymbol) {
        this.visitStructBase(symbol);
    }

    override visitState(symbol: UCStateSymbol) {
        this.visitStructBase(symbol);

        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    override visitMethod(symbol: UCMethodSymbol) {
        for (let child = symbol.children; child; child = child.next) {
            // Parameter?
            if (isParamSymbol(child) && child.defaultExpression) {
                const type = child.getType();
                const context: ContextInfo | undefined = {
                    contextType: type
                };
                child.defaultExpression.index(this.document, symbol, context);
            }
        }

        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    override visitReplicationBlock(symbol: UCReplicationBlock) {
        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    override visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock) {
        // Children (archetypes) are indexed by the ObjectDeclaration statements.
        // this.visitStructBase(symbol);

        if (symbol.block) {
            // index in the default context (i.e. the class or generated archetype)
            console.assert(typeof symbol.default !== 'undefined', 'symbol.default is undefined');
            symbol.block.index(this.document, symbol.default);
        }
    }

    override visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement): void {
        return;
    }

    override visitArchetypeSymbol(symbol: UCArchetypeSymbol): void {
        // symbol.index(this.document, symbol);
    }
}
