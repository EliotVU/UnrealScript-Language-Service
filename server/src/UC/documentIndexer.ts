import { UCDocument } from './document';
import {
    ContextInfo, hasChildren, isParamSymbol, UCClassSymbol, UCDefaultPropertiesBlock, UCEnumSymbol,
    UCMethodSymbol, UCReplicationBlock, UCScriptStructSymbol, UCStateSymbol, UCStructSymbol
} from './Symbols';
import { DefaultSymbolWalker } from './symbolWalker';

/**
 * Will initiate the indexing of all struct symbols that contain a block.
 * The indexing of a block is handled separately here so that we can resolve recursive dependencies within blocks.
 */
export class DocumentIndexer extends DefaultSymbolWalker<undefined> {
    constructor(private document: UCDocument) {
        super();
    }

    visitStructBase(symbol: UCStructSymbol) {
        for (let child = symbol.children; child; child = child.next) {
            if (hasChildren(child)) {
                child.accept(this);
            }
        }
    }

    visitEnum(symbol: UCEnumSymbol) { return; }
	visitScriptStruct(symbol: UCScriptStructSymbol) { return; }

    visitClass(symbol: UCClassSymbol) {
        this.visitStructBase(symbol);
    }

    visitState(symbol: UCStateSymbol) {
        this.visitStructBase(symbol);

        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    visitMethod(symbol: UCMethodSymbol) {
        for (let child = symbol.children; child; child = child.next) {
            // Parameter?
            if (child && isParamSymbol(child) && child.defaultExpression) {
                const typeFlags = child.getType()?.getTypeFlags();
                const context: ContextInfo | undefined = {
                    typeFlags: typeFlags
                };
                child.defaultExpression.index(this.document, symbol, context);
            }
        }

        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    visitDefaultPropertiesBlock(symbol: UCDefaultPropertiesBlock) {
        this.visitStructBase(symbol);

        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }

    visitReplicationBlock(symbol: UCReplicationBlock) {
        if (symbol.block) {
            symbol.block.index(this.document, symbol);
        }
    }
}
