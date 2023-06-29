import { UCDocument } from './document';
import {
    ContextInfo,
    isArchetypeSymbol,
    isParamSymbol,
    isStruct,
    UCClassSymbol,
    UCDefaultPropertiesBlock,
    UCEnumSymbol,
    UCMethodSymbol,
    UCReplicationBlock,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
} from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

/**
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

    override visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock) {
        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }

        if (isArchetypeSymbol(symbol.default)) {
            symbol.default.index(this.document, symbol.default);
        }
    }

    override visitReplicationBlock(symbol: UCReplicationBlock) {
        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }
}
