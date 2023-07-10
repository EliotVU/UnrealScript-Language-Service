import { ParserRuleContext, Token } from 'antlr4ts';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { Range } from 'vscode-languageserver-types';

import { UCLexer } from './antlr/generated/UCLexer';
import * as UCGrammar from './antlr/generated/UCParser';
import { UCParserVisitor } from './antlr/generated/UCParserVisitor';
import * as UCMacro from './antlr/generated/UCPreprocessorParser';
import { UCPreprocessorParserVisitor } from './antlr/generated/UCPreprocessorParserVisitor';
import { ErrorDiagnostic } from './diagnostics/diagnostic';
import { UCDocument } from './document';
import {
    IExpression,
    UCArrayCountExpression,
    UCAssignmentOperatorExpression,
    UCBinaryOperatorExpression,
    UCBoolLiteral,
    UCCallExpression,
    UCConditionalExpression,
    UCDefaultAssignmentExpression,
    UCDefaultElementAccessExpression,
    UCDefaultMemberCallExpression,
    UCDefaultStructLiteral,
    UCElementAccessExpression,
    UCEmptyArgument,
    UCFloatLiteral,
    UCIdentifierLiteralExpression,
    UCIntLiteral,
    UCMemberExpression,
    UCMetaClassExpression,
    UCNameLiteral,
    UCNameOfExpression,
    UCNewExpression,
    UCNoneLiteral,
    UCObjectLiteral,
    UCParenthesizedExpression,
    UCPostOperatorExpression,
    UCPredefinedAccessExpression,
    UCPreOperatorExpression,
    UCPropertyAccessExpression,
    UCPropertyClassAccessExpression,
    UCRngLiteral,
    UCRotLiteral,
    UCSizeOfLiteral,
    UCStringLiteral,
    UCSuperExpression,
    UCVectLiteral,
} from './expressions';
import { rangeFromBound, rangeFromBounds, rangeFromCtx } from './helpers';
import { config, setEnumMember } from './indexer';
import { toName } from './name';
import {
    NAME_ARRAY,
    NAME_CLASS,
    NAME_DEFAULTPROPERTIES,
    NAME_DELEGATE,
    NAME_ENUMCOUNT,
    NAME_MAP,
    NAME_NONE,
    NAME_REPLICATION,
    NAME_RETURNVALUE,
    NAME_STRUCTDEFAULTPROPERTIES,
} from './names';
import { getCtxDebugInfo } from './Parser/Parser.utils';
import { UCTokenStream } from './Parser/TokenStream';
import { UCGeneration } from './settings';
import {
    IStatement,
    UCArchetypeBlockStatement,
    UCAssertStatement,
    UCBlock,
    UCCaseClause,
    UCControlStatement,
    UCDefaultClause,
    UCDoUntilStatement,
    UCEmptyStatement,
    UCExpressionStatement,
    UCForEachStatement,
    UCForStatement,
    UCGotoStatement,
    UCIfStatement,
    UCLabeledStatement,
    UCRepIfStatement,
    UCReturnStatement,
    UCSwitchStatement,
    UCWhileStatement,
} from './statements';
import {
    addHashedSymbol,
    hasNoKind,
    Identifier,
    isStatement,
    ISymbol,
    ISymbolContainer,
    ITypeSymbol,
    MethodFlags,
    ModifierFlags,
    StaticErrorType,
    UCArchetypeSymbol,
    UCArrayTypeSymbol,
    UCBinaryOperatorSymbol,
    UCClassSymbol,
    UCConstSymbol,
    UCDefaultPropertiesBlock,
    UCDelegateSymbol,
    UCDelegateTypeSymbol,
    UCEmptySymbol,
    UCEnumMemberSymbol,
    UCEnumSymbol,
    UCEventSymbol,
    UCInterfaceSymbol,
    UCLocalSymbol,
    UCMacroSymbol,
    UCMapTypeSymbol,
    UCMethodSymbol,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCParamSymbol,
    UCPostOperatorSymbol,
    UCPreOperatorSymbol,
    UCPropertySymbol,
    UCQualifiedTypeSymbol,
    UCReplicationBlock,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
    UCTypeSymbol,
} from './Symbols';

function createIdentifier(ctx: ParserRuleContext) {
    const identifier: Identifier = {
        name: toName(ctx.text),
        range: rangeFromBound(ctx.start)
    };

    return identifier;
}

function createIdentifierFromToken(token: Token) {
    const identifier: Identifier = {
        name: toName(token.text!),
        range: rangeFromBound(token)
    };

    return identifier;
}

function createMemberExpression(ctx: UCGrammar.IdentifierContext): UCMemberExpression {
    const expression = new UCMemberExpression(createIdentifier(ctx));
    return expression;
}

function createBlock(
    visitor: DocumentASTWalker,
    nodes?: ParserRuleContext[]
): UCBlock | undefined {
    if (!nodes || nodes.length === 0) {
        return undefined;
    }

    const startToken = nodes[0].start;
    const stopToken = nodes[nodes.length - 1].stop;
    const block = new UCBlock(rangeFromBounds(startToken, stopToken));
    block.statements = new Array(nodes.length);
    for (let i = 0; i < nodes.length; ++i) {
        try {
            const statement: IStatement | undefined = nodes[i].accept(visitor);
            if (statement && hasNoKind(statement)) {
                console.warn('Caught a corrupted statement', getCtxDebugInfo(nodes[i]));
                continue;
            }
            block.statements[i] = statement;
        } catch (err) {
            console.error(`(internal transformation error)`, getCtxDebugInfo(nodes[i]));
        }
    }
    return block;
}

function createTypeFromIdentifiers(identifiers: Identifier[]): UCQualifiedTypeSymbol | UCObjectTypeSymbol | undefined {
    if (identifiers.length === 1) {
        return new UCObjectTypeSymbol(identifiers[0]);
    } else if (identifiers.length > 1) {
        const get = (i: number): UCQualifiedTypeSymbol => {
            const type = new UCObjectTypeSymbol(identifiers[i]);
            const leftType = i - 1 > -1 ? get(--i) : undefined;
            return new UCQualifiedTypeSymbol(type, leftType);
        };
        return get(identifiers.length - 1);
    }
    return undefined;
}

function createObjectType(ctx: ParserRuleContext, kind?: UCSymbolKind) {
    const id: Identifier = createIdentifier(ctx);
    const type = new UCObjectTypeSymbol(id, id.range, kind);
    return type;
}

function createQualifiedType(ctx: UCGrammar.QualifiedIdentifierContext, kind?: UCSymbolKind) {
    const leftId: Identifier = createIdentifier(ctx._left);
    const leftType = new UCObjectTypeSymbol(leftId, leftId.range, kind);

    if (ctx._right) {
        const rightId: Identifier = createIdentifier(ctx._right);
        const rightType = new UCObjectTypeSymbol(rightId, rightId.range);

        const symbol = new UCQualifiedTypeSymbol(rightType, new UCQualifiedTypeSymbol(leftType));
        switch (kind) {
            case UCSymbolKind.ScriptStruct:
                leftType.setExpectedKind(UCSymbolKind.Class);
                break;

            case UCSymbolKind.State:
                leftType.setExpectedKind(UCSymbolKind.Class);
                break;

            case UCSymbolKind.Delegate:
                leftType.setExpectedKind(UCSymbolKind.Class);
                rightType.setExpectedKind(UCSymbolKind.Delegate);
                break;

            case UCSymbolKind.Class:
                leftType.setExpectedKind(UCSymbolKind.Package);
                break;

            default:
                leftType.setExpectedKind(UCSymbolKind.Class);
                break;
        }
        return symbol;
    }
    return leftType;
}

function fetchDeclarationComments(tokenStream: UCTokenStream, ctx: ParserRuleContext): Token | Token[] | undefined {
    if (ctx.stop) {
        const leadingComment = tokenStream.fetchLeadingComment(ctx.stop);
        if (leadingComment?.line === ctx.stop.line && leadingComment.type !== UCLexer.EOF) {
            return leadingComment;
        }
    }

    return tokenStream.fetchHeaderComment(ctx.start);
}

const TypeKeywordToTypeKindMap: { [key: number]: UCTypeKind } = {
    [UCLexer.KW_BYTE]: UCTypeKind.Byte,
    [UCLexer.KW_FLOAT]: UCTypeKind.Float,
    [UCLexer.KW_INT]: UCTypeKind.Int,
    [UCLexer.KW_STRING]: UCTypeKind.String,
    [UCLexer.KW_NAME]: UCTypeKind.Name,
    [UCLexer.KW_BOOL]: UCTypeKind.Bool,
    [UCLexer.KW_POINTER]: UCTypeKind.Pointer,
    [UCLexer.KW_BUTTON]: UCTypeKind.Button
};

export class DocumentASTWalker extends AbstractParseTreeVisitor<any> implements UCPreprocessorParserVisitor<any>, UCParserVisitor<any> {
    private scopes: ISymbolContainer<ISymbol>[] = [];

    constructor(
        private document: UCDocument,
        private defaultScope: ISymbolContainer<ISymbol>,
        private tokenStream: UCTokenStream | undefined
    ) {
        super();
        this.scopes.push(defaultScope);
    }

    push(newContext: ISymbolContainer<ISymbol>) {
        this.scopes.push(newContext);
    }

    pop() {
        this.scopes.pop();
    }

    scope<T extends ISymbolContainer<ISymbol> & UCObjectSymbol>(): T {
        const scope = <T>this.scopes[this.scopes.length - 1];
        return scope;
    }

    declare(symbol: UCObjectSymbol, ctx?: ParserRuleContext, registerHash = false) {
        if (ctx) {
            symbol.description = fetchDeclarationComments(this.tokenStream!, ctx);
        }

        const scope = this.scope();
        scope.addSymbol(symbol);
        if (registerHash) {
            addHashedSymbol(symbol);
        }
    }

    visitMacroDefine(ctx: UCMacro.MacroDefineContext) {
        if (!ctx.isActive) {
            // TODO: mark range?
            return undefined;
        }
        const macro = ctx._MACRO_SYMBOL;
        const identifier = createIdentifierFromToken(macro);
        // TODO: custom class
        const symbol = new UCMacroSymbol(identifier);
        this.document.addSymbol(symbol);
        
        return symbol;
    }

    visitIdentifier(ctx: UCGrammar.IdentifierContext): Identifier {
        return createIdentifier(ctx);
    }

    visitQualifiedIdentifier(ctx: UCGrammar.QualifiedIdentifierContext) {
        return createQualifiedType(ctx);
    }

    visitTypeDecl(typeDeclNode: UCGrammar.TypeDeclContext): ITypeSymbol {
        const rule = typeDeclNode.getChild(0) as ParserRuleContext;
        switch (rule.ruleIndex) {
            // TODO: Handle string type's size for analysis
            case UCGrammar.UCParser.RULE_stringType:
            case UCGrammar.UCParser.RULE_primitiveType: {
                const tokenType = rule.start.type;
                const typeKind = TypeKeywordToTypeKindMap[tokenType];
                if (typeof typeKind === 'undefined') {
                    throw new Error(`Unknown type '${UCGrammar.UCParser.VOCABULARY.getDisplayName(tokenType)}' for predefinedType() was encountered!`);
                }

                // With UE3 the pointer type was displaced by a struct i.e Core.Object.Pointer.
                if (typeKind == UCTypeKind.Pointer && config.generation == UCGeneration.UC3) {
                    const type: ITypeSymbol = createObjectType(rule, UCSymbolKind.Field);
                    return type;
                }

                const type = new UCTypeSymbol(typeKind, rangeFromBounds(rule.start, rule.stop));
                return type;
            }

            case UCGrammar.UCParser.RULE_qualifiedIdentifier: {
                const type: ITypeSymbol = createQualifiedType(rule as UCGrammar.QualifiedIdentifierContext, UCSymbolKind.Field);
                return type;
            }

            case UCGrammar.UCParser.RULE_classType: {
                const identifier: Identifier = {
                    name: NAME_CLASS,
                    range: rangeFromBound(rule.start)
                };
                const type = new UCObjectTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop), UCSymbolKind.Class);

                const idNode = (rule as UCGrammar.ClassTypeContext).identifier();
                if (idNode) {
                    const identifier = createIdentifier(idNode);
                    const metaClassType = new UCObjectTypeSymbol(identifier, undefined, UCSymbolKind.Class);
                    type.baseType = metaClassType;
                }
                return type;
            }

            case UCGrammar.UCParser.RULE_arrayType: {
                const identifier: Identifier = {
                    name: NAME_ARRAY,
                    range: rangeFromBound(rule.start)
                };
                const arrayType = new UCArrayTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));

                const baseTypeNode = (rule as UCGrammar.ArrayTypeContext).varType();
                if (baseTypeNode) {
                    const innerType: ITypeSymbol | undefined = this.visitTypeDecl(baseTypeNode.typeDecl());
                    arrayType.baseType = innerType;
                }
                return arrayType;
            }

            case UCGrammar.UCParser.RULE_delegateType: {
                const identifier: Identifier = {
                    name: NAME_DELEGATE,
                    range: rangeFromBound(rule.start)
                };
                const delegateType = new UCDelegateTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
                delegateType.setExpectedKind(UCSymbolKind.Delegate);

                const qualifiedNode = (rule as UCGrammar.DelegateTypeContext).qualifiedIdentifier();
                if (qualifiedNode) {
                    const innerType: ITypeSymbol = createQualifiedType(qualifiedNode, UCSymbolKind.Delegate);
                    delegateType.baseType = innerType;
                }
                return delegateType;
            }

            case UCGrammar.UCParser.RULE_mapType: {
                const identifier: Identifier = {
                    name: NAME_MAP,
                    range: rangeFromBound(rule.start)
                };
                const type = new UCMapTypeSymbol(identifier, rangeFromBounds(rule.start, rule.stop));
                return type;
            }

            case UCGrammar.UCParser.RULE_structDecl: {
                const symbol: UCStructSymbol = this.visitStructDecl(rule as UCGrammar.StructDeclContext);
                const type = new UCObjectTypeSymbol(symbol.id, undefined, UCSymbolKind.ScriptStruct);
                type.setRefNoIndex(symbol);
                return type;
            }

            case UCGrammar.UCParser.RULE_enumDecl: {
                const symbol: UCEnumSymbol = this.visitEnumDecl(rule as UCGrammar.EnumDeclContext);
                const type = new UCObjectTypeSymbol(symbol.id, undefined, UCSymbolKind.Enum);
                type.setRefNoIndex(symbol);
                return type;
            }

            default:
                throw "Encountered an unknown typeDecl:" + typeDeclNode.toString();
        }
    }

    visitInterfaceDecl(ctx: UCGrammar.InterfaceDeclContext) {
        if (this.document.class) {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromCtx(ctx), 'Cannot declare an interface within an interface!'));
            return undefined;
        }

        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCInterfaceSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
        symbol.outer = this.document.classPackage;
        this.document.class = symbol; // Important!, must be assigned before further parsing.

        if (this.document.class) {
            addHashedSymbol(symbol);
        }
        this.declare(symbol, ctx);

        const extendsNode = ctx.qualifiedExtendsClause();
        if (extendsNode) {
            symbol.extendsType = createQualifiedType(extendsNode._id, UCSymbolKind.Interface);
        }

        // Need to push before visiting modifiers.
        this.push(symbol);
        const modifierNodes = ctx.interfaceModifier();
        for (const modifierNode of modifierNodes) {
            switch (modifierNode.start.type) {
                case UCGrammar.UCParser.KW_NATIVE:
                case UCGrammar.UCParser.KW_NATIVEONLY:
                    symbol.modifiers |= ModifierFlags.Native;
                    break;

                case UCGrammar.UCParser.KW_DEPENDSON:
                    this.visitDependsOnModifier(modifierNode as UCGrammar.DependsOnModifierContext);
                    break;
            }
        }
        return symbol;
    }

    visitClassDecl(ctx: UCGrammar.ClassDeclContext) {
        // Most of the time a document's tree is invalid as the end-user is writing code.
        // Therefor the parser may mistake "class'Object' <stuff here>;"" for a construction of a class declaration, this then leads to a messed up scope stack.
        // Or alternatively someone literally did try to declare another class?
        if (this.document.class) {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromCtx(ctx), 'Cannot declare a class within a class!'));
            return undefined;
        }

        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCClassSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));
        symbol.outer = this.document.classPackage;
        this.document.class = symbol; // Important!, must be assigned before further parsing.

        if (this.document.class) {
            addHashedSymbol(symbol);
        }
        this.declare(symbol, ctx);

        const extendsNode = ctx.qualifiedExtendsClause();
        if (extendsNode) {
            symbol.extendsType = createQualifiedType(extendsNode._id, UCSymbolKind.Class);
        }

        const withinNode = ctx.qualifiedWithinClause();
        if (withinNode) {
            symbol.withinType = createQualifiedType(withinNode._id, UCSymbolKind.Class);
        }

        // Need to push before visiting modifiers.
        this.push(symbol);
        const modifierNodes = ctx.classModifier();
        for (const modifierNode of modifierNodes) {
            switch (modifierNode.start.type) {
                case UCGrammar.UCParser.KW_NATIVE:
                    symbol.modifiers |= ModifierFlags.Native;
                    break;

                case UCGrammar.UCParser.KW_TRANSIENT:
                    symbol.modifiers |= ModifierFlags.Transient;
                    break;

                case UCGrammar.UCParser.KW_DEPENDSON:
                    this.visitDependsOnModifier(modifierNode as UCGrammar.DependsOnModifierContext);
                    break;

                case UCGrammar.UCParser.KW_IMPLEMENTS:
                    this.visitImplementsModifier(modifierNode as UCGrammar.ImplementsModifierContext);
                    break;

                // case UCGrammar.UCParser.KW_ABSTRACT:
                //     symbol.modifiers |= ModifierFlags.Abstract;
                //     break;
            }
        }
        return symbol;
    }

    visitDependsOnModifier(ctx: UCGrammar.DependsOnModifierContext) {
        const symbol = this.scope<UCClassSymbol>();
        const modifierArgumentNodes = ctx.identifierArguments?.();
        if (modifierArgumentNodes) {
            symbol.dependsOnTypes = modifierArgumentNodes
                .identifier()
                .map(valueNode => {
                    const identifier: Identifier = valueNode.accept(this);
                    const typeSymbol = new UCObjectTypeSymbol(identifier, undefined, UCSymbolKind.Class);
                    return typeSymbol;
                });
        }
    }

    visitImplementsModifier(ctx: UCGrammar.ImplementsModifierContext) {
        const symbol = this.scope<UCClassSymbol>();
        const modifierArgumentNodes = ctx.qualifiedIdentifierArguments?.();
        if (modifierArgumentNodes) {
            symbol.implementsTypes = modifierArgumentNodes
                .qualifiedIdentifier()
                .map(valueNode => {
                    const typeSymbol = createQualifiedType(valueNode, UCSymbolKind.Class);
                    return typeSymbol;
                });
        }
    }

    visitConstDecl(ctx: UCGrammar.ConstDeclContext) {
        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCConstSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

        // Manually inject description, because a 'const' is passed to this.declare()
        symbol.description = fetchDeclarationComments(this.tokenStream!, ctx);

        if (ctx._value) {
            symbol.expression = ctx._value.accept(this);
        }

        if (this.document.class) {
            // Ensure that all constant declarations are always declared as a top level field (i.e. class)
            this.document.class.addSymbol(symbol);
        }
        return symbol;
    }

    visitEnumDecl(ctx: UCGrammar.EnumDeclContext) {
        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCEnumSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

        this.declare(symbol, ctx, !!this.document.class);
        this.push(symbol);
        try {
            let count = 0;
            const memberNodes = ctx.enumMember();
            for (const memberNode of memberNodes) {
                const memberSymbol: UCEnumMemberSymbol = memberNode.accept(this);
                // HACK: overwrite define() outer let.
                memberSymbol.outer = symbol;
                memberSymbol.value = count++;
            }
            symbol.maxValue = count;

            if (config.generation === UCGeneration.UC3) {
                if (symbol.children) {
                    const prefixIndex = symbol.children.id.name.text.lastIndexOf('_');
                    if (prefixIndex !== -1) {
                        const prefix = symbol.children.id.name.text.substring(0, prefixIndex);
                        const maxName = toName(prefix + "_MAX");
                        const enumId: Identifier = { name: maxName, range: identifier.range };
                        const maxEnumMember = new UCEnumMemberSymbol(enumId, enumId.range);
                        maxEnumMember.modifiers |= ModifierFlags.Generated;
                        maxEnumMember.outer = symbol;
                        maxEnumMember.value = count;
                        this.declare(maxEnumMember);
                        setEnumMember(maxEnumMember);
                    }
                }
            }

            // Insert the intrinsic "EnumCount" as an enum member,
            // -- but don't register it, we don't want to index, nor link it in the linked children..
            const enumId: Identifier = { name: NAME_ENUMCOUNT, range: identifier.range };
            const enumCountMember = new UCEnumMemberSymbol(enumId, enumId.range);
            enumCountMember.modifiers |= ModifierFlags.Intrinsic;
            // FIXME: Is this worth it? This allows an end-user to find all its references.
            enumCountMember.outer = symbol;
            enumCountMember.value = count;
            symbol.enumCountMember = enumCountMember;
        } finally {
            this.pop();
        }
        return symbol;
    }

    visitEnumMember(ctx: UCGrammar.EnumMemberContext) {
        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCEnumMemberSymbol(identifier);

        this.declare(symbol, ctx);
        setEnumMember(symbol);
        return symbol;
    }

    visitStructDecl(ctx: UCGrammar.StructDeclContext) {
        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCScriptStructSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

        const modifierNodes = ctx.structModifier();
        for (const modifierNode of modifierNodes) {
            switch (modifierNode.start.type) {
                case UCGrammar.UCParser.KW_NATIVE:
                    symbol.modifiers |= ModifierFlags.Native;
                    break;

                case UCGrammar.UCParser.KW_TRANSIENT:
                    symbol.modifiers |= ModifierFlags.Transient;
                    break;
            }
        }

        const extendsNode = ctx.qualifiedExtendsClause();
        if (extendsNode) {
            symbol.extendsType = createQualifiedType(extendsNode._id, UCSymbolKind.ScriptStruct);
        }

        this.declare(symbol, ctx, !!this.document.class);

        this.push(symbol);
        try {
            const memberNodes = ctx.structMember();
            if (memberNodes) for (const member of memberNodes) {
                member.accept(this);
            }
        } finally {
            this.pop();
        }
        return symbol;
    }

    visitReplicationBlock(ctx: UCGrammar.ReplicationBlockContext) {
        const identifier: Identifier = {
            name: NAME_REPLICATION,
            range: rangeFromBound(ctx.start)
        };
        const symbol = new UCReplicationBlock(identifier, rangeFromBounds(ctx.start, ctx.stop));
        symbol.super = this.document.class;
        this.declare(symbol, ctx);

        const statementNodes = ctx.replicationStatement();
        if (!statementNodes) {
            return undefined;
        }

        symbol.block = createBlock(this, ctx.replicationStatement());
        return symbol;
    }

    visitFunctionDecl(ctx: UCGrammar.FunctionDeclContext) {
        const nameNode: UCGrammar.FunctionNameContext | undefined = ctx.tryGetRuleContext(0, UCGrammar.FunctionNameContext);

        let modifiers: ModifierFlags = 0;
        let specifiers: MethodFlags = MethodFlags.None;
        let precedence: number | undefined;

        const specifierNodes = ctx.functionSpecifier();
        for (const specifier of specifierNodes) {
            switch (specifier.start.type) {
                case UCGrammar.UCParser.KW_NATIVE:
                    modifiers |= ModifierFlags.Native;
                    break;
                case UCGrammar.UCParser.KW_INTRINSIC:
                    modifiers |= ModifierFlags.Native;
                    break;
                case UCGrammar.UCParser.KW_CONST:
                    modifiers |= ModifierFlags.ReadOnly;
                    break;
                case UCGrammar.UCParser.KW_PROTECTED:
                    modifiers |= ModifierFlags.Protected;
                    break;
                case UCGrammar.UCParser.KW_PRIVATE:
                    modifiers |= ModifierFlags.Private;
                    break;
                case UCGrammar.UCParser.KW_FUNCTION:
                    specifiers |= MethodFlags.Function;
                    break;
                case UCGrammar.UCParser.KW_OPERATOR:
                    specifiers |= MethodFlags.Operator;
                    if (specifier._operatorPrecedence) {
                        precedence = Number(specifier._operatorPrecedence.text);
                    }
                    break;
                case UCGrammar.UCParser.KW_PREOPERATOR:
                    specifiers |= MethodFlags.PreOperator;
                    break;
                case UCGrammar.UCParser.KW_POSTOPERATOR:
                    specifiers |= MethodFlags.PostOperator;
                    break;
                case UCGrammar.UCParser.KW_DELEGATE:
                    specifiers |= MethodFlags.Delegate;
                    break;
                case UCGrammar.UCParser.KW_ITERATOR:
                    specifiers |= MethodFlags.Iterator;
                    break;
                case UCGrammar.UCParser.KW_EVENT:
                    specifiers |= MethodFlags.Event;
                    break;
                case UCGrammar.UCParser.KW_STATIC:
                    specifiers |= MethodFlags.Static | MethodFlags.Final;
                    break;
                case UCGrammar.UCParser.KW_FINAL:
                    specifiers |= MethodFlags.Final;
                    break;
                case UCGrammar.UCParser.KW_TRANSIENT:
                    modifiers |= ModifierFlags.Transient;
                    break;
            }
        }

        const type = (specifiers & MethodFlags.Function)
            ? UCMethodSymbol
            : (specifiers & MethodFlags.Event)
                ? UCEventSymbol
                : (specifiers & MethodFlags.Operator)
                    ? UCBinaryOperatorSymbol
                    : (specifiers & MethodFlags.PreOperator)
                        ? UCPreOperatorSymbol
                        : (specifiers & MethodFlags.PostOperator)
                            ? UCPostOperatorSymbol
                            : (specifiers & MethodFlags.Delegate)
                                ? UCDelegateSymbol
                                : UCMethodSymbol;

        if ((specifiers & MethodFlags.HasKind) === 0) {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.start),
                `Method must be declared as either one of the following: (Function, Event, Operator, PreOperator, PostOperator, or Delegate).`
            ));
        }

        const range = rangeFromBounds(ctx.start, ctx.stop);
        // nameNode may be undefined if the end-user is in process of writing a new function.
        const identifier: Identifier = nameNode
            ? createIdentifier(nameNode)
            : { name: NAME_NONE, range: rangeFromBound(ctx.start) };
        const symbol = new type(identifier, range);
        symbol.specifiers |= specifiers;
        symbol.modifiers |= modifiers;
        if (precedence) {
            (symbol as UCBinaryOperatorSymbol).precedence = precedence;
        }
        this.declare(symbol, ctx);

        this.push(symbol);
        try {
            if (ctx._returnParam) {
                let paramModifiers: ModifierFlags = ModifierFlags.ReturnParam
                    | ModifierFlags.Out
                    | ModifierFlags.Generated;
                const modifierNode = ctx._returnParam.returnTypeModifier();
                if (modifierNode?.start.type === UCGrammar.UCParser.KW_COERCE) {
                    paramModifiers |= ModifierFlags.Coerce;
                }

                const typeSymbol = this.visitTypeDecl(ctx._returnParam.typeDecl());
                const returnValueId: Identifier = {
                    name: NAME_RETURNVALUE,
                    range: typeSymbol.getRange()
                };
                const returnValue = new UCParamSymbol(returnValueId, returnValueId.range, typeSymbol);
                returnValue.modifiers |= paramModifiers;

                this.declare(returnValue);
                symbol.returnValue = returnValue;
            }

            if (ctx._params) {
                const paramNodes = ctx._params.paramDecl();
                symbol.params = Array(paramNodes.length);
                for (let i = 0; i < paramNodes.length; ++i) {
                    symbol.params[i] = paramNodes[i].accept(this);
                }
            }

            try {
                const bodyNode = ctx.functionBody();
                if (bodyNode) {
                    bodyNode.accept(this);
                }
            } catch (err) {
                console.error(`Encountered an error while constructing the body for function '${symbol.getPath()}'`, err, getCtxDebugInfo(ctx));
            }
        } catch (err) {
            console.error(`Encountered an error while constructing function '${symbol.getPath()}'`, err, getCtxDebugInfo(ctx));
        } finally {
            this.pop();
        }
        return symbol;
    }

    visitFunctionBody(ctx: UCGrammar.FunctionBodyContext) {
        const memberNodes = ctx.functionMember();
        if (memberNodes) for (const member of memberNodes) {
            member.accept(this);
        }

        const method = this.scope<UCMethodSymbol>();
        method.block = createBlock(this, ctx.statement());
    }

    visitParamDecl(ctx: UCGrammar.ParamDeclContext) {
        let modifiers: ModifierFlags = 0;
        const modifierNodes = ctx.paramModifier();
        for (const modNode of modifierNodes) {
            switch (modNode.start.type) {
                case UCGrammar.UCParser.KW_CONST:
                    modifiers |= ModifierFlags.ReadOnly;
                    break;
                case UCGrammar.UCParser.KW_OUT:
                    modifiers |= ModifierFlags.Out;
                    break;
                case UCGrammar.UCParser.KW_OPTIONAL:
                    modifiers |= ModifierFlags.Optional;
                    break;
                case UCGrammar.UCParser.KW_COERCE:
                    modifiers |= ModifierFlags.Coerce;
                    break;
                case UCGrammar.UCParser.KW_REF:
                    modifiers |= ModifierFlags.Ref;
                    break;
            }
        }

        const propTypeNode = ctx.typeDecl();
        const typeSymbol = this.visitTypeDecl(propTypeNode);

        const varNode = ctx.variable();

        const identifier: Identifier = createIdentifier(varNode.identifier());
        const symbol = new UCParamSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop), typeSymbol);
        if (ctx._expr) {
            symbol.defaultExpression = ctx._expr.accept(this);
            modifiers |= ModifierFlags.Optional;
        }
        symbol.modifiers |= modifiers;

        this.initVariable(symbol, varNode);
        this.declare(symbol, ctx);
        return symbol;
    }

    initVariable(property: UCPropertySymbol, ctx: UCGrammar.VariableContext) {
        const arrayDimNode = ctx._arrayDim;
        if (!arrayDimNode) {
            return;
        }

        property.modifiers |= ModifierFlags.WithDimension;

        const qualifiedNode = arrayDimNode.qualifiedIdentifier();
        if (qualifiedNode) {
            property.arrayDimRef = qualifiedNode.accept(this);
            property.arrayDimRange = property.arrayDimRef?.getRange();
            return;
        }

        const intNode = arrayDimNode.INTEGER_LITERAL();
        if (intNode) {
            property.arrayDim = Number.parseInt(intNode.text);
            property.arrayDimRange = rangeFromBound(intNode.symbol);
        }
    }

    visitLocalDecl(ctx: UCGrammar.LocalDeclContext): undefined {
        const propTypeNode = ctx.typeDecl();
        const typeSymbol = this.visitTypeDecl(propTypeNode);

        const varNodes = ctx.variable();
        for (const varNode of varNodes) {
            const symbol: UCLocalSymbol = varNode.accept(this);
            symbol.type = typeSymbol;
            this.declare(symbol, ctx);
        }
        
        return undefined;
    }

    visitVarDecl(ctx: UCGrammar.VarDeclContext): undefined {
        let modifiers: ModifierFlags = 0;

        const declTypeNode: UCGrammar.VarTypeContext | undefined = ctx.varType();
        if (typeof declTypeNode !== 'undefined') {
            const modifierNodes = declTypeNode.variableModifier();
            for (const modNode of modifierNodes) {
                switch (modNode.start.type) {
                    case UCGrammar.UCParser.KW_CONST:
                        modifiers |= ModifierFlags.ReadOnly;
                        break;
                    case UCGrammar.UCParser.KW_NATIVE:
                        modifiers |= ModifierFlags.Native;
                        break;
                    case UCGrammar.UCParser.KW_INTRINSIC:
                        modifiers |= ModifierFlags.Native;
                        break;
                    case UCGrammar.UCParser.KW_PROTECTED:
                        modifiers |= ModifierFlags.Protected;
                        break;
                    case UCGrammar.UCParser.KW_PRIVATE:
                        modifiers |= ModifierFlags.Private;
                        break;
                    case UCGrammar.UCParser.KW_TRANSIENT:
                        modifiers |= ModifierFlags.Transient;
                        break;
                }
            }
        }

        let typeSymbol: ITypeSymbol;
        const typeDeclCtx = declTypeNode?.tryGetRuleContext(0, UCGrammar.TypeDeclContext);
        // Bad grammar, fallback to an error if the parsed rule is invalid.
        if (typeof typeDeclCtx === 'undefined') {
            typeSymbol = new UCTypeSymbol(UCTypeKind.Error, rangeFromCtx(declTypeNode));
            this.document.nodes.push(new ErrorDiagnostic(rangeFromCtx(declTypeNode), "Mismatched type input."));

        } else {
            typeSymbol = this.visitTypeDecl(typeDeclCtx);
        }

        const varNodes = ctx.variable();
        if (varNodes) for (const varNode of varNodes) {
            const symbol: UCPropertySymbol = varNode.accept(this);
            symbol.type = typeSymbol;
            symbol.modifiers |= modifiers;
            this.declare(symbol, ctx);
        }
        
        return undefined;
    }

    visitVariable(ctx: UCGrammar.VariableContext) {
        const type = ctx.parent instanceof UCGrammar.LocalDeclContext
            ? UCLocalSymbol
            : UCPropertySymbol;

        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol: UCPropertySymbol = new type(
            identifier,
            // Stop at varCtx instead of localCtx for multiple variable declarations.
            rangeFromBounds(ctx.parent!.start, ctx.stop),
            StaticErrorType
        );
        this.initVariable(symbol, ctx);
        return symbol;
    }

    visitStateDecl(ctx: UCGrammar.StateDeclContext) {
        const identifier: Identifier = createIdentifier(ctx.identifier());
        const symbol = new UCStateSymbol(identifier, rangeFromBounds(ctx.start, ctx.stop));

        const extendsNode = ctx.extendsClause();
        if (extendsNode) {
            symbol.extendsType = createObjectType(extendsNode._id, UCSymbolKind.State);
        }

        this.declare(symbol, ctx);
        this.push(symbol);
        try {
            const memberNodes = ctx.stateMember();
            if (memberNodes) for (const member of memberNodes) {
                member.accept(this);
            }
            symbol.block = createBlock(this, ctx.statement());
        } finally {
            this.pop();
        }

        return symbol;
    }

    // TODO: Refactor this as a statement
    visitIgnoresDecl(ctx: UCGrammar.IgnoresDeclContext): undefined {
        const scope = this.scope<UCStateSymbol>();
        const idNodes = ctx.identifier();
        if (idNodes) {
            const ignoreRefs = idNodes.map(n => {
                const identifier: Identifier = createIdentifier(n);
                const ref = new UCObjectTypeSymbol(identifier);
                return ref;
            });
            if (!scope.ignoreRefs) {
                scope.ignoreRefs = [];
            }
            scope.ignoreRefs = scope.ignoreRefs.concat(ignoreRefs);
        }
        
        return undefined;
    }

    visitStructDefaultPropertiesBlock(ctx: UCGrammar.StructDefaultPropertiesBlockContext) {
        const identifier: Identifier = {
            name: NAME_STRUCTDEFAULTPROPERTIES,
            range: rangeFromBound(ctx.start)
        };
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const symbol = new UCDefaultPropertiesBlock(identifier, range);
        symbol.default = this.scope<UCStructSymbol>();

        this.declare(symbol, ctx);
        this.push(symbol);
        try {
            symbol.block = createBlock(this, ctx.defaultStatement());
        } finally {
            this.pop();
        }
        return symbol;
    }

    visitDefaultPropertiesBlock(ctx: UCGrammar.DefaultPropertiesBlockContext) {
        const identifier: Identifier = {
            name: NAME_DEFAULTPROPERTIES,
            range: rangeFromBound(ctx.start)
        };
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const symbol = new UCDefaultPropertiesBlock(identifier, range);

        this.declare(symbol, ctx);
        this.push(symbol);
        try {
            let defaultObject: UCArchetypeSymbol | undefined;
            if (config.generation === UCGeneration.UC3) {
                const defaultId: Identifier = {
                    name: toName(`Default__${this.document.name.text}`),
                    range: identifier.range
                };
                defaultObject = new UCArchetypeSymbol(defaultId, range);
                defaultObject.modifiers |= ModifierFlags.Generated;
                defaultObject.outer = this.document.classPackage;
                defaultObject.super = this.document.class;
                this.declare(defaultObject);
                symbol.default = defaultObject;
            } else {
                symbol.default = this.document.class!;
            }
            symbol.block = createBlock(this, ctx.defaultStatement());
            if (defaultObject) {
                defaultObject.block = symbol.block;
            }
        } finally {
            this.pop();
        }
        return symbol;
    }

    visitObjectDecl(ctx: UCGrammar.ObjectDeclContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const block = new UCArchetypeBlockStatement(range);

        let nameExpr: UCDefaultAssignmentExpression | undefined;
        let nameId: Identifier | undefined;
        let nameType: UCTypeSymbol | undefined;
        let classExpr: UCDefaultAssignmentExpression | undefined;
        let classId: Identifier | undefined;
        let classType: UCObjectTypeSymbol | undefined;

        const hardcodedStatements: IExpression[] = [];
        const attrs = ctx.objectAttribute();
        if (attrs) for (const objAttr of attrs) {
            switch (objAttr._id.type) {
                case UCLexer.KW_NAME: {
                    nameExpr = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));
                    nameExpr.left = new UCMemberExpression(createIdentifierFromToken(objAttr._id));
                    nameId = createIdentifier(objAttr._value);
                    const idExpr = new UCIdentifierLiteralExpression(nameId);
                    nameType = new UCTypeSymbol(UCTypeKind.Name);
                    idExpr.type = nameType;
                    nameExpr.right = idExpr;
                    hardcodedStatements.push(nameExpr);
                    break;
                }

                case UCLexer.KW_CLASS: {
                    classExpr = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));
                    classExpr.left = new UCMemberExpression(createIdentifierFromToken(objAttr._id));
                    classId = createIdentifier(objAttr._value);
                    const idExpr = new UCIdentifierLiteralExpression(classId);
                    classType = new UCObjectTypeSymbol(classId, undefined, UCSymbolKind.Class);
                    idExpr.type = classType;
                    classExpr.right = idExpr;
                    hardcodedStatements.push(classExpr);
                    break;
                }

                default:
                    throw Error(`Invalid archetype '${objAttr._id.text}' variable!`);
            }
        }

        const archId = nameId ?? { name: NAME_NONE, range };
        const symbol = new UCArchetypeSymbol(archId, range);
        if (classType) {
            symbol.extendsType = classType;
        }
        block.archetypeSymbol = symbol;

        this.declare(symbol, ctx);
        this.push(symbol);
        try {
            const statementNodes = ctx.defaultStatement();
            block.statements = hardcodedStatements
                .concat(statementNodes
                    .map(node => node.accept(this))
                );
        } finally {
            this.pop();
        }
        return block;
    }

    visitDefaultStatement(ctx: UCGrammar.DefaultStatementContext) {
        const child = ctx.getChild(0);
        const expr = child?.accept(this);
        if (expr) {
            const statement = new UCExpressionStatement(rangeFromCtx(ctx));
            statement.expression = expr;
            return statement;
        }

        return new UCEmptyStatement(rangeFromCtx(ctx));
    }

    visitDefaultValue(ctx: UCGrammar.DefaultValueContext) {
        const child = ctx.getChild(0);
        return child?.accept(this);
    }

    visitDefaultConstantArgument(ctx: UCGrammar.DefaultConstantArgumentContext): IExpression | undefined {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const token = ctx.start;
        switch (token.type) {
            case UCGrammar.UCParser.DECIMAL_LITERAL:
            case UCGrammar.UCParser.INTEGER_LITERAL: {
                const expression = new UCIntLiteral(range, ctx._start);
                return expression;
            }
        }
        return ctx.defaultIdentifierRef()?.accept(this);
    }

    visitDefaultAssignmentExpression(ctx: UCGrammar.DefaultAssignmentExpressionContext) {
        const expression = new UCDefaultAssignmentExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx.defaultExpression();
        expression.left = primaryNode?.accept(this);

        const exprNode = ctx.defaultValue();
        expression.right = exprNode?.accept(this);
        return expression;
    }

    visitDefaultMemberExpression(ctx: UCGrammar.DefaultMemberExpressionContext) {
        return createMemberExpression(ctx.identifier());
    }

    visitDefaultMemberCallExpression(ctx: UCGrammar.DefaultMemberCallExpressionContext) {
        const expression = new UCDefaultMemberCallExpression(rangeFromBounds(ctx.start, ctx.stop));
        expression.propertyMember = createMemberExpression(ctx.identifier(0));
        const operationId = createIdentifier(ctx.identifier(1));
        expression.operationMember = new UCObjectTypeSymbol(operationId);
        expression.arguments = ctx.defaultArguments()?.accept(this);
        return expression;
    }

    visitDefaultElementAccessExpression(ctx: UCGrammar.DefaultElementAccessExpressionContext) {
        const expression = new UCDefaultElementAccessExpression(rangeFromBounds(ctx.start, ctx.stop));
        const idNode = ctx.identifier();
        if (idNode) {
            expression.expression = createMemberExpression(idNode);
        }
        expression.argument = ctx._arg?.accept(this);
        return expression;
    }

    visitStatement(ctx: UCGrammar.StatementContext) {
        const child = ctx.getChild(0)!;
        console.assert(typeof child !== 'undefined');
        const stm = child.accept<IStatement>(this);
        console.assert(typeof stm !== 'undefined');
        console.assert(isStatement(stm), `Statement is invalid: ${getCtxDebugInfo(ctx)}`);
        return stm;
    }

    visitEmptyStatement(ctx: UCGrammar.EmptyStatementContext) {
        return new UCEmptyStatement(rangeFromCtx(ctx));
    }

    // Directives can occur in a statement or declaration scope.
    // For the time being we don't want to run into analysis errors, so we transform directives into pseudo object symbols.
    visitDirective(ctx: UCGrammar.DirectiveContext) {
        return new UCEmptySymbol({ name: NAME_NONE, range: rangeFromCtx(ctx) });
        // return new UCEmptyStatement(rangeFromCtx(ctx));
    }

    visitAssignmentStatement(ctx: UCGrammar.AssignmentStatementContext) {
        const statement = new UCExpressionStatement(rangeFromCtx(ctx));
        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        return statement;
    }

    visitExpressionStatement(ctx: UCGrammar.ExpressionStatementContext) {
        const statement = new UCExpressionStatement(rangeFromCtx(ctx));
        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        return statement;
    }

    visitContinueStatement(ctx: UCGrammar.ContinueStatementContext): IStatement {
        return new UCControlStatement(rangeFromCtx(ctx));
    }

    visitBreakStatement(ctx: UCGrammar.BreakStatementContext): IStatement {
        return new UCControlStatement(rangeFromCtx(ctx));
    }

    visitStopStatement(ctx: UCGrammar.StopStatementContext): IStatement {
        return new UCControlStatement(rangeFromCtx(ctx));
    }

    visitLabeledStatement(ctx: UCGrammar.LabeledStatementContext): UCLabeledStatement {
        const statement = new UCLabeledStatement(rangeFromBounds(ctx.start, ctx.stop));
        const idNode = ctx.identifier();
        statement.label = createIdentifier(idNode);
        const struct = this.scope<UCStructSymbol>();
        struct.addLabel(statement.label);
        return statement;
    }

    visitReturnStatement(ctx: UCGrammar.ReturnStatementContext): IStatement {
        const statement = new UCReturnStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        return statement;
    }

    visitGotoStatement(ctx: UCGrammar.GotoStatementContext): IStatement {
        const statement = new UCGotoStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        return statement;
    }

    visitReplicationStatement(ctx: UCGrammar.ReplicationStatementContext): UCIfStatement {
        const statement = new UCRepIfStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const idNodes = ctx.identifier();
        if (idNodes) {
            statement.symbolRefs = idNodes.map(n => {
                const identifier = createIdentifier(n);
                const ref = new UCObjectTypeSymbol(identifier);
                return ref;
            });
        }
        return statement;
    }

    visitWhileStatement(ctx: UCGrammar.WhileStatementContext): UCWhileStatement {
        const statement = new UCWhileStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const blockNode = ctx.codeBlockOptional();
        statement.then = createBlock(this, blockNode.statement());
        return statement;
    }

    visitIfStatement(ctx: UCGrammar.IfStatementContext): UCIfStatement {
        const statement = new UCIfStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const blockNode = ctx.codeBlockOptional();
        statement.then = createBlock(this, blockNode.statement());

        const elseStatementNode = ctx.elseStatement();
        if (elseStatementNode) {
            statement.else = elseStatementNode.accept(this);
        }
        return statement;
    }

    visitElseStatement(ctx: UCGrammar.ElseStatementContext) {
        const blockNode = ctx.codeBlockOptional();
        return createBlock(this, blockNode.statement());
    }

    visitDoStatement(ctx: UCGrammar.DoStatementContext): UCDoUntilStatement {
        const statement = new UCDoUntilStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const blockNode = ctx.codeBlockOptional();
        statement.then = createBlock(this, blockNode.statement());
        return statement;
    }

    visitForeachStatement(ctx: UCGrammar.ForeachStatementContext): UCForEachStatement {
        const statement = new UCForEachStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const blockNode = ctx.codeBlockOptional();
        statement.then = createBlock(this, blockNode.statement());
        return statement;
    }

    visitForStatement(ctx: UCGrammar.ForStatementContext): UCForStatement {
        const statement = new UCForStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._initExpr) {
            statement.init = ctx._initExpr.accept(this);
        }

        // Not really a valid expression with an assignment, but this is done this way for our convenience.
        // TODO: Obviously check if type can be resolved to a boolean!
        if (ctx._condExpr) {
            statement.expression = ctx._condExpr.accept(this);
        }

        if (ctx._nextExpr) {
            statement.next = ctx._nextExpr.accept(this);
        }

        const blockNode = ctx.codeBlockOptional();
        statement.then = createBlock(this, blockNode.statement());
        return statement;
    }

    visitSwitchStatement(ctx: UCGrammar.SwitchStatementContext): IStatement {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const statement = new UCSwitchStatement(range);

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }

        const clauseNodes: ParserRuleContext[] = ctx.caseClause() || [];
        const defaultClauseNode = ctx.defaultClause();

        if (defaultClauseNode) {
            clauseNodes.push(defaultClauseNode);
        }

        statement.then = createBlock(this, clauseNodes);
        return statement;
    }

    visitCaseClause(ctx: UCGrammar.CaseClauseContext): IStatement {
        const statement = new UCCaseClause(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        statement.then = createBlock(this, ctx.statement());
        return statement;
    }

    visitDefaultClause(ctx: UCGrammar.DefaultClauseContext) {
        const statement = new UCDefaultClause(rangeFromBounds(ctx.start, ctx.stop));
        statement.then = createBlock(this, ctx.statement());
        return statement;
    }

    visitAssertStatement(ctx: UCGrammar.AssertStatementContext): IStatement {
        const statement = new UCAssertStatement(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            statement.expression = ctx._expr.accept(this);
        }
        return statement;
    }

    visitAssignmentExpression(ctx: UCGrammar.AssignmentExpressionContext) {
        const expression = new UCAssignmentOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

        const operatorNode = ctx._id;
        const identifier: Identifier = {
            name: toName(operatorNode.text!),
            range: rangeFromBound(operatorNode)
        };

        if (operatorNode.text !== '=') {
            expression.operator = new UCObjectTypeSymbol(identifier);
        }

        const primaryNode = ctx._left;
        expression.left = primaryNode.accept(this);

        const exprNode = ctx._right;
        if (exprNode) {
            expression.right = exprNode.accept(this);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(identifier.range, "Expression expected."));
        }

        return expression;
    }

    visitConditionalExpression(ctx: UCGrammar.ConditionalExpressionContext) {
        const expression = new UCConditionalExpression(rangeFromBounds(ctx.start, ctx.stop));

        const conditionNode = ctx._cond;
        if (conditionNode) {
            expression.condition = conditionNode.accept(this);
        }

        const leftNode = ctx._left;
        if (leftNode) {
            expression.true = leftNode.accept(this);
        }

        const rightNode = ctx._right;
        if (rightNode) {
            expression.false = rightNode.accept(this);
        }
        return expression;
    }

    visitBinaryOperatorExpression(ctx: UCGrammar.BinaryOperatorExpressionContext) {
        const expression = new UCBinaryOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

        const leftNode = ctx._left;
        if (leftNode) {
            expression.left = leftNode.accept(this);
        }

        const operatorNode = ctx._id;
        const identifier: Identifier = {
            name: toName(operatorNode.text!),
            range: rangeFromBound(operatorNode)
        };
        expression.operator = new UCObjectTypeSymbol(identifier);

        const rightNode = ctx._right;
        if (rightNode) {
            expression.right = rightNode.accept(this);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(operatorNode), "Expression expected."));
        }
        return expression;
    }

    visitBinaryNamedOperatorExpression(ctx: UCGrammar.BinaryNamedOperatorExpressionContext) {
        const expression = new UCBinaryOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

        const leftNode = ctx._left;
        if (leftNode) {
            expression.left = leftNode.accept(this);
        }

        const operatorNode = ctx._id;
        const identifier = createIdentifier(operatorNode);
        expression.operator = new UCObjectTypeSymbol(identifier);

        const rightNode = ctx._right;
        if (rightNode) {
            expression.right = rightNode.accept(this);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(identifier.range, "Expression expected."));
        }
        return expression;
    }

    visitPostOperatorExpression(ctx: UCGrammar.PostOperatorExpressionContext) {
        const expression = new UCPostOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx._left;
        expression.expression = primaryNode.accept(this);

        const operatorNode = ctx._id;
        const identifier: Identifier = {
            name: toName(operatorNode.text!),
            range: rangeFromBound(operatorNode)
        };
        expression.operator = new UCObjectTypeSymbol(identifier);
        return expression;
    }

    visitPreOperatorExpression(ctx: UCGrammar.PreOperatorExpressionContext) {
        const expression = new UCPreOperatorExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx._right;
        expression.expression = primaryNode.accept(this);

        const operatorNode = ctx._id;
        const identifier: Identifier = {
            name: toName(operatorNode.text!),
            range: rangeFromBound(operatorNode)
        };
        expression.operator = new UCObjectTypeSymbol(identifier);
        return expression;
    }

    // visitPostNamedOperatorExpression(ctx: UCGrammar.PostNamedOperatorExpressionContext) {
    // 	const expression = new UCPostOperatorExpression();

    // 	const primaryNode = ctx._left;
    // 	expression.expression = primaryNode.accept(this);

    // 	const operatorNode = ctx._id;
    // 	expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
    // 	return expression;
    // }

    // visitPreNamedOperatorExpression(ctx: UCGrammar.PreNamedOperatorExpressionContext) {
    // 	const expression = new UCPreOperatorExpression();

    // 	const primaryNode = ctx._right;
    // 	expression.expression = primaryNode.accept(this);

    // 	const operatorNode = ctx._id;
    // 	expression.operator = new UCSymbolReference(createIdentifierFrom(operatorNode));
    // 	return expression;
    // }

    visitParenthesizedExpression(ctx: UCGrammar.ParenthesizedExpressionContext) {
        const expression = new UCParenthesizedExpression(rangeFromBounds(ctx.start, ctx.stop));
        expression.expression = ctx._expr?.accept<IExpression>(this);
        return expression;
    }

    visitPropertyAccessExpression(ctx: UCGrammar.PropertyAccessExpressionContext) {
        const expression = new UCPropertyAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx.primaryExpression();
        expression.left = primaryNode.accept<IExpression>(this);

        const idNode = ctx.identifier();
        if (idNode) {
            expression.member = createMemberExpression(idNode);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.stop!),
                `Identifier expected.`
            ));
        }
        return expression;
    }

    visitPropertyClassAccessExpression(ctx: UCGrammar.PropertyClassAccessExpressionContext) {
        const expression = new UCPropertyClassAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx.primaryExpression();
        expression.left = primaryNode.accept<IExpression>(this);

        const idNode = ctx.identifier();
        if (idNode) {
            expression.member = createMemberExpression(idNode);
        } else {
            this.document.nodes.push(new ErrorDiagnostic(rangeFromBound(ctx.stop!),
                `Identifier expected.`
            ));
        }
        return expression;
    }

    visitMemberExpression(ctx: UCGrammar.MemberExpressionContext) {
        return createMemberExpression(ctx.identifier());
    }

    visitCallExpression(ctx: UCGrammar.CallExpressionContext) {
        const expression = new UCCallExpression(rangeFromBounds(ctx.start, ctx.stop));

        // expr ( arguments )
        const exprNode = ctx.primaryExpression();
        expression.expression = exprNode.accept(this);
        expression.arguments = ctx.arguments()?.accept(this);
        return expression;
    }

    visitArguments(ctx: UCGrammar.ArgumentsContext): IExpression[] {
        const exprArgs = [];
        for (let i = 0; i < ctx.children!.length; ++i) {
            const arg = ctx.children![i].accept(this);
            if (!arg) {
                continue;
            }
            exprArgs.push(arg);
        }
        return exprArgs;
    }

    visitArgument(ctx: UCGrammar.ArgumentContext): IExpression {
        return ctx.expression().accept(this);
    }

    visitEmptyArgument(ctx: UCGrammar.EmptyArgumentContext): IExpression {
        return new UCEmptyArgument(rangeFromBounds(ctx.start, ctx.stop));
    }

    visitDefaultArguments(ctx: UCGrammar.DefaultArgumentsContext): IExpression[] | undefined {
        const argumentNodes = ctx.defaultArgument();
        if (!argumentNodes) {
            return undefined;
        }

        const exprArgs = new Array(argumentNodes.length);
        for (let i = 0; i < exprArgs.length; ++i) {
            const argNode = argumentNodes[i];
            const expr = argNode.accept(this);
            if (!expr) {
                exprArgs[i] = new UCEmptyArgument(rangeFromBounds(argNode.start, argNode.stop));
                continue;
            }
            exprArgs[i] = expr;
        }
        return exprArgs;
    }

    visitDefaultArgument(ctx: UCGrammar.DefaultArgumentContext): IExpression | undefined {
        const exprNode = ctx.defaultValue();
        return exprNode?.accept(this);
    }

    // primaryExpression [ expression ]
    visitElementAccessExpression(ctx: UCGrammar.ElementAccessExpressionContext) {
        const expression = new UCElementAccessExpression(rangeFromBounds(ctx.start, ctx.stop));

        const primaryNode = ctx.primaryExpression();
        expression.expression = primaryNode.accept(this);
        expression.argument = ctx._arg?.accept(this);
        return expression;
    }

    // new ( arguments ) classArgument=primaryExpression
    visitNewExpression(ctx: UCGrammar.NewExpressionContext) {
        const expression = new UCNewExpression(rangeFromBounds(ctx.start, ctx.stop));

        expression.expression = ctx._expr.accept(this);

        const exprArgumentNodes = ctx.arguments();
        if (exprArgumentNodes) {
            expression.arguments = exprArgumentNodes.accept(this);
        }
        return expression;
    }

    visitMetaClassExpression(ctx: UCGrammar.MetaClassExpressionContext) {
        const expression = new UCMetaClassExpression(rangeFromBounds(ctx.start, ctx.stop));

        const classIdNode = ctx.identifier();
        if (classIdNode) {
            expression.classRef = new UCObjectTypeSymbol(createIdentifier(classIdNode), undefined, UCSymbolKind.Class);
        }

        if (ctx._expr) {
            expression.expression = ctx._expr.accept(this);
        }
        return expression;
    }

    visitSuperExpression(ctx: UCGrammar.SuperExpressionContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCSuperExpression(range);

        const superIdNode = ctx.identifier();
        if (superIdNode) {
            expression.structTypeRef = new UCObjectTypeSymbol(createIdentifier(superIdNode));
        }
        return expression;
    }

    visitSelfReferenceExpression(ctx: UCGrammar.SelfReferenceExpressionContext) {
        const expression = new UCPredefinedAccessExpression(createIdentifier(ctx));
        return expression;
    }

    visitDefaultReferenceExpression(ctx: UCGrammar.DefaultReferenceExpressionContext) {
        const expression = new UCPredefinedAccessExpression(createIdentifier(ctx));
        return expression;
    }

    visitStaticAccessExpression(ctx: UCGrammar.StaticAccessExpressionContext) {
        const expression = new UCPredefinedAccessExpression(createIdentifier(ctx));
        return expression;
    }

    visitGlobalAccessExpression(ctx: UCGrammar.GlobalAccessExpressionContext) {
        const expression = new UCPredefinedAccessExpression(createIdentifier(ctx));
        return expression;
    }

    visitSizeOfToken(ctx: UCGrammar.SizeOfTokenContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCSizeOfLiteral(range);

        const idNode = ctx.identifier();
        if (idNode) {
            const identifier: Identifier = createIdentifier(idNode);
            expression.argumentRef = new UCObjectTypeSymbol(identifier, undefined, UCSymbolKind.Class);
        }

        return expression;
    }

    visitArrayCountExpression(ctx: UCGrammar.ArrayCountExpressionContext) {
        const expression = new UCArrayCountExpression(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            expression.argument = ctx._expr.accept<IExpression>(this);
        }
        return expression;
    }

    visitArrayCountToken(ctx: UCGrammar.ArrayCountTokenContext) {
        const expression = new UCArrayCountExpression(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            expression.argument = ctx._expr.accept<IExpression>(this);
        }
        return expression;
    }

    visitNameOfToken(ctx: UCGrammar.NameOfTokenContext) {
        const expression = new UCNameOfExpression(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            expression.argument = ctx._expr.accept<IExpression>(this);
        }
        return expression;
    }

    visitNameOfExpression(ctx: UCGrammar.NameOfExpressionContext) {
        const expression = new UCNameOfExpression(rangeFromBounds(ctx.start, ctx.stop));

        if (ctx._expr) {
            expression.argument = ctx._expr.accept<IExpression>(this);
        }
        return expression;
    }

    visitLiteral(ctx: UCGrammar.LiteralContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const token = ctx.start;
        switch (token.type) {
            case UCGrammar.UCParser.NONE_LITERAL:
                return new UCNoneLiteral(range);

            case UCGrammar.UCParser.STRING_LITERAL:
                return new UCStringLiteral(range, token);

            case UCGrammar.UCParser.INTEGER_LITERAL:
                return new UCIntLiteral(range, token);

            case UCGrammar.UCParser.DECIMAL_LITERAL:
                return new UCFloatLiteral(range, token);

            case UCGrammar.UCParser.BOOLEAN_LITERAL:
                return new UCBoolLiteral(range, token);

            case UCGrammar.UCParser.NAME_LITERAL: {
                const text = token.text!;
                const name = toName(text.substring(1, text.length - 1));
                const id: Identifier = {
                    name: name,
                    range: rangeFromBound(token)
                };
                return new UCNameLiteral(id);
            }

            default:
                throw new Error(`Unsupported literal type '${UCGrammar.UCParser.VOCABULARY.getDisplayName(token.type)}'`);
        }
    }

    visitSignedNumericLiteral(ctx: UCGrammar.SignedNumericLiteralContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        let expression: UCFloatLiteral | UCIntLiteral;
        const txt = ctx.text;
        if (txt.includes('.')) {
            expression = new UCFloatLiteral(range, ctx.start);
        } else {
            expression = new UCIntLiteral(range, ctx.start);
        }
        return expression;
    }

    visitObjectLiteral(ctx: UCGrammar.ObjectLiteralContext) {
        const expression = new UCObjectLiteral(rangeFromBounds(ctx.start, ctx.stop));

        const classIdNode = ctx._classRef;
        const castRef = new UCObjectTypeSymbol(createIdentifier(classIdNode), undefined, UCSymbolKind.Class);
        expression.castRef = castRef;

        const objectIdNode = ctx._path;
        const startLine = objectIdNode.line - 1;
        let startChar = objectIdNode.charPositionInLine + 1;
        const identifiers: Identifier[] = objectIdNode.text!
            .replace(/'|\s/g, "")
            .split('.')
            .map(txt => {
                const identifier: Identifier = {
                    name: toName(txt),
                    range: {
                        start: {
                            line: startLine,
                            character: startChar
                        },
                        end: {
                            line: startLine,
                            character: startChar + txt.length
                        }
                    } as Range
                };
                startChar += txt.length + 1;
                return identifier;
            });

        const type = createTypeFromIdentifiers(identifiers);
        expression.objectRef = type;
        return expression;
    }

    visitVectToken(ctx: UCGrammar.VectTokenContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCVectLiteral(range);
        return expression;
    }

    visitRotToken(ctx: UCGrammar.RotTokenContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCRotLiteral(range);
        return expression;
    }

    visitRngToken(ctx: UCGrammar.RngTokenContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCRngLiteral(range);
        return expression;
    }

    visitDefaultStructLiteral(ctx: UCGrammar.DefaultStructLiteralContext) {
        const range = rangeFromBounds(ctx.start, ctx.stop);
        const expression = new UCDefaultStructLiteral(range);

        // FIXME: Assign structType

        return expression;
    }

    visitDefaultQualifiedIdentifierRef(ctx: UCGrammar.DefaultQualifiedIdentifierRefContext): undefined {
        // TODO: Support
        return undefined;
    }

    visitDefaultIdentifierRef(ctx: UCGrammar.DefaultIdentifierRefContext) {
        const expression = new UCIdentifierLiteralExpression(createIdentifier(ctx));
        return expression;
    }

    protected defaultResult(): undefined {
        return undefined;
    }
}
