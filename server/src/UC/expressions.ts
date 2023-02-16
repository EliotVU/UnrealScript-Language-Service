import { Position, Range } from 'vscode-languageserver';

import { UCDocument } from './document';
import { intersectsWith } from './helpers';
import { config, getEnumMember } from './indexer';
import {
    CastTypeSymbolMap,
    ContextInfo,
    CORE_PACKAGE,
    DefaultArray,
    findOrIndexClassSymbol,
    findOverloadedOperator,
    findSuperStruct,
    getConversionCost,
    getOuter,
    getSymbolHash,
    getSymbolOuterHash,
    hasDefinedBaseType,
    Identifier,
    INode,
    IntrinsicClass,
    IntrinsicRngLiteral,
    IntrinsicRotLiteral,
    IntrinsicVectLiteral,
    isConstSymbol,
    isFunction,
    isOperator,
    isProperty,
    isStateSymbol,
    isStruct,
    ISymbol,
    ITypeSymbol,
    IWithIndex,
    IWithInnerSymbols,
    ModifierFlags,
    ObjectsTable,
    OuterObjectsTable,
    resolveType,
    StaticBoolType,
    StaticByteType,
    StaticErrorType,
    StaticFloatType,
    StaticIntType,
    StaticMetaType,
    StaticNameType,
    StaticNoneType,
    StaticRangeType,
    StaticRotatorType,
    StaticStringType,
    StaticVectorType,
    tryFindClassSymbol,
    UCArrayTypeSymbol,
    UCClassSymbol,
    UCMethodSymbol,
    UCNodeKind,
    UCObjectSymbol,
    UCObjectTypeSymbol,
    UCPackage,
    UCQualifiedTypeSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
    UCTypeSymbol,
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IExpression extends INode, IWithIndex, IWithInnerSymbols {
    getRange(): Range;
    getMemberSymbol(): ISymbol | undefined;
    // TODO: Refactor to never return undefined, always return a StaticErrorType instead.
    getType(): ITypeSymbol | undefined;
    getSymbolAtPos(position: Position): ISymbol | undefined;
    getValue(): number | undefined;

    // TODO: Consider using visitor pattern to index.
    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo): void;
    accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export abstract class UCExpression implements IExpression {
    kind = UCNodeKind.Expression;

    constructor(protected range: Range) {
    }

    getRange(): Range {
        return this.range;
    }

    getMemberSymbol(): ISymbol | undefined {
        return undefined;
    }

    getType(): ITypeSymbol | undefined {
        return StaticErrorType;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (!intersectsWith(this.getRange(), position)) {
            return undefined;
        }
        const symbol = this.getContainedSymbolAtPos(position);
        return symbol;
    }

    getValue(): number | undefined {
        return undefined;
    }

    abstract getContainedSymbolAtPos(position: Position): ISymbol | undefined;
    index(_document: UCDocument, _context?: UCStructSymbol, _info?: ContextInfo): void {
        //
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitExpression(this);
    }
}

export class UCParenthesizedExpression implements IExpression {
    kind = UCNodeKind.Expression;

    public expression?: IExpression;

    constructor(protected range: Range) {
    }

    getRange(): Range {
        return this.range;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (!intersectsWith(this.getRange(), position)) {
            return undefined;
        }
        const symbol = this.getContainedSymbolAtPos(position);
        return symbol;
    }

    getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.expression?.getSymbolAtPos(position);
        return symbol;
    }

    getType() {
        return this.expression?.getType();
    }

    getValue(): number | undefined {
        return undefined;
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitExpression(this);
    }
}

export class UCArrayCountExpression extends UCExpression {
    public argument?: IExpression;

    getValue() {
        const symbol = this.argument?.getMemberSymbol();
        return symbol && isProperty(symbol) && symbol.getArrayDimSize() || undefined;
    }

    getMemberSymbol() {
        return this.argument?.getMemberSymbol();
    }

    getType() {
        return StaticIntType;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.argument?.getSymbolAtPos(position);
        return symbol;
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.argument?.index(document, context, info);
    }
}

export class UCNameOfExpression extends UCExpression {
    public argument?: IExpression;

    getMemberSymbol() {
        return this.argument?.getMemberSymbol();
    }

    getType() {
        return StaticNameType;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.argument?.getSymbolAtPos(position);
        return symbol;
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.argument?.index(document, context, info);
    }
}

export class UCEmptyArgument extends UCExpression {
    getContainedSymbolAtPos(_position: Position) {
        return undefined;
    }
}

export class UCCallExpression extends UCExpression {
    public expression: IExpression;
    public arguments?: Array<IExpression>;

    getMemberSymbol() {
        return this.expression.getMemberSymbol();
    }

    getType() {
        const type = this.expression.getType();
        const symbol = type?.getRef();
        if (symbol && isFunction(symbol)) {
            const returnValue = symbol.returnValue;
            if (returnValue) {
                // Coerce the return type to match that of the first passed argument, e.g. "coerce Object Spawn(class'Actor' actor);"
                if (returnValue.hasAnyModifierFlags(ModifierFlags.Coerce) && this.arguments) {
                    const firstArgumentType = this.arguments[0]?.getType();
                    return firstArgumentType;
                }
                const returnValueType = returnValue.getType();
                return returnValueType;
            }
            return undefined;
        }
        return type;
    }

    // FIXME: Yeah... easier than re-doing how symbols are fetched :P
    static hack_getTypeIfNoSymbol: boolean | undefined;
    getContainedSymbolAtPos(position: Position) {
        const symbol = this.expression.getSymbolAtPos(position);
        if (symbol) {
            return symbol;
        }

        if (this.arguments) for (const arg of this.arguments) {
            const symbol = arg.getSymbolAtPos(position);
            if (symbol) {
                return symbol;
            }
        }

        if (UCCallExpression.hack_getTypeIfNoSymbol) {
            return this.getType();
        }
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        if (!this.arguments?.length) {
            this.expression.index(document, context);
            return;
        }

        /**
         * The compiler has a hacky implementation for casts/function calls.
         * 
         * It will first check if the name could be a reference to a class.
         * If it's a match, then the first argument is compiled, 
         * if the argument is not an Object type or hit another argument, then it assumes it's a function call.
         */
        if (this.arguments.length == 1 && this.expression instanceof UCMemberExpression) {
            const member = this.expression;
            const name = member.id.name;

            // Casting to a int, byte, bool? etc...
            // TODO: Handle this in the parser.
            const primitiveType = CastTypeSymbolMap.get(name);
            if (primitiveType) {
                member.type = primitiveType;
            } else {
                // Casting to a Class, Struct, or Enum?
                // TODO: Check first argument type, because if it's not a valid object, a function call must be assumed
                const structSymbol = tryFindClassSymbol(name) ?? ObjectsTable.getSymbol(name);
                if (structSymbol) {
                    const type = new UCObjectTypeSymbol(member.id);
                    type.setRef(structSymbol, document);
                    member.type = type;
                } else { // Maybe a function
                    const funcSymbol = isStruct(context) && context.findSuperSymbol<UCMethodSymbol>(name);
                    if (funcSymbol) {
                        const type = new UCObjectTypeSymbol(member.id);
                        type.setRef(funcSymbol, document);
                        member.type = type;
                    }
                }
            }
        } else { // default binding
            this.expression.index(document, context);
        }

        const methodType = this.expression.getType();
        const methodSymbol = methodType?.getRef();
        if (methodSymbol && isFunction(methodSymbol)) {
            if (methodSymbol.params) {
                const argInfo: ContextInfo = {
                    contextType: StaticErrorType,
                    inAssignment: false,
                };
                for (let i = 0; i < this.arguments.length; ++i) {
                    if (i < methodSymbol.params.length) {
                        const param = methodSymbol.params[i];
                        argInfo.contextType = param.getType();
                        argInfo.inAssignment = param.hasAnyModifierFlags(ModifierFlags.Out);
                        this.arguments[i].index(document, context, argInfo);
                    } else {
                        // * Excessive arguments, we will still index the arguements.
                        this.arguments[i].index(document, context, {
                            contextType: StaticErrorType,
                            inAssignment: false
                        });
                    }
                }
            } else {
                // * Excessive arguments, we will still index the arguements.
                for (let i = 0; i < this.arguments.length; ++i) {
                    this.arguments[i].index(document, context, {
                        contextType: StaticErrorType,
                        inAssignment: false
                    });
                }
            }
        } else {
            // TODO: Handle call on array??
            for (let i = 0; i < this.arguments.length; ++i) {
                const arg = this.arguments[i];
                arg.index(document, context, {
                    contextType: StaticErrorType,
                    inAssignment: false
                });
            }
        }
    }
}

export class UCElementAccessExpression extends UCExpression {
    public expression: IExpression;
    public argument?: IExpression;

    getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    // Returns the type we are working with after [] has taken affect, this means we return undefined if the type is invalid.
    getType() {
        const type = this.expression?.getType();
        if (type && UCArrayTypeSymbol.is(type)) {
            // Resolve metaclass class<Actor> to Actor
            if (hasDefinedBaseType(type) && hasDefinedBaseType(type.baseType)) {
                return type.baseType.baseType;
            }
            return type.baseType;
        } else {
            const symbol = this.getMemberSymbol();
            if (symbol && isProperty(symbol) && symbol.isFixedArray()) {
                // metaclass is resolved in @UCMemberExpression's .getType
                return type;
            }
        }
        return undefined;
    }

    getContainedSymbolAtPos(position: Position) {
        return this.expression?.getSymbolAtPos(position) ?? this.argument?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
        this.argument?.index(document, context, info);
    }
}

export class UCDefaultElementAccessExpression extends UCElementAccessExpression {
    declare expression: UCMemberExpression;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
        // this.argument?.index(document, context, info);

        if (this.argument && this.argument instanceof UCIdentifierLiteralExpression) {
            const id = this.argument.id;
            const symbol = (isStruct(context) && context.findSuperSymbol(id.name)) ?? getEnumMember(id.name);
            if (symbol) {
                const type = new UCObjectTypeSymbol(id);
                type.setRef(symbol, document);
                this.argument.type = type;
            }
        }
    }
}

export class UCPropertyAccessExpression extends UCExpression {
    public left: IExpression;
    public member: UCMemberExpression | undefined;

    getMemberSymbol() {
        return this.member?.getMemberSymbol();
    }

    getType() {
        return this.member?.getType();
    }

    getContainedSymbolAtPos(position: Position) {
        return this.member?.getSymbolAtPos(position) ?? this.left.getSymbolAtPos(position);
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        // DO NOT PASS @info, only our right expression needs access to @info.
        this.left.index(document, context);

        if (this.member) {
            const leftType = this.left.getType();
            // Resolve meta class
            const ref = leftType?.getRef<UCStructSymbol>();
            const memberContext = (ref === IntrinsicClass)
                ? resolveType(leftType!).getRef<UCStructSymbol>()
                : ref;
            if (memberContext && isStruct(memberContext)) {
                this.member.index(document, memberContext, info);
            }
        }
    }
}

export class UCConditionalExpression extends UCExpression {
    public condition!: IExpression;
    public true?: IExpression;
    public false?: IExpression;

    getMemberSymbol() {
        return this.true?.getMemberSymbol();
    }

    getType() {
        return this.true?.getType();
    }

    getContainedSymbolAtPos(position: Position) {
        return this.condition.getSymbolAtPos(position)
            ?? this.true?.getSymbolAtPos(position)
            ?? this.false?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.condition.index(document, context, info);
        this.true?.index(document, context, info);
        this.false?.index(document, context, info);
    }
}

export abstract class UCBaseOperatorExpression extends UCExpression {
    public expression: IExpression;
    public operator: UCObjectTypeSymbol;

    getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    getType() {
        const operatorSymbol = this.operator.getRef();
        if (operatorSymbol && isOperator(operatorSymbol)) {
            return operatorSymbol.getType();
        }
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.operator.getSymbolAtPos(position);
        if (symbol && this.operator.getRef()) {
            return symbol;
        }
        return this.expression.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.expression.index(document, context, info);
    }
}

export class UCPostOperatorExpression extends UCBaseOperatorExpression {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.operator && this.expression) {
            const type = this.expression.getType();
            if (type) {
                const opId = this.operator.getName();
                const operatorSymbol = findOverloadedOperator(context, opId, (
                    symbol => symbol.isPostOperator()
                        && symbol.params?.length === 1
                        && getConversionCost(type, symbol.params[0].getType()) === 1
                ));
                if (operatorSymbol) {
                    this.operator.setRef(operatorSymbol, document);
                }
            }
        }
    }
}

export class UCPreOperatorExpression extends UCBaseOperatorExpression {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.operator && this.expression) {
            const type = this.expression.getType();
            if (type) {
                const opId = this.operator.getName();
                const operatorSymbol = findOverloadedOperator(context, opId, (
                    symbol => symbol.isPreOperator()
                        && symbol.params?.length === 1
                        && getConversionCost(type, symbol.params[0].getType()) === 1
                ));
                if (operatorSymbol) {
                    this.operator.setRef(operatorSymbol, document);
                }
            }
        }
    }
}

export class UCBinaryOperatorExpression extends UCExpression {
    public left?: IExpression;
    public operator?: UCObjectTypeSymbol;
    public right?: IExpression;

    getMemberSymbol() {
        return this.operator?.getRef();
    }

    getType() {
        const operatorSymbol = this.operator?.getRef();
        if (operatorSymbol && isFunction(operatorSymbol) && operatorSymbol.isBinaryOperator()) {
            return operatorSymbol.getType();
        }
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.operator?.getSymbolAtPos(position);
        if (symbol && this.operator!.getRef()) {
            return symbol;
        }
        return this.left?.getSymbolAtPos(position) ?? this.right?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        let leftType: ITypeSymbol;
        if (this.left) {
            this.left.index(document, context, info);
            leftType = getExpressionTypeSafe(this.left);
        } else {
            leftType = StaticErrorType;
        }

        let rightType: ITypeSymbol;
        if (this.right) {
            this.right.index(document, context, {
                contextType: leftType
            });
            rightType = getExpressionTypeSafe(this.right);
        } else {
            rightType = StaticErrorType;
        }

        if (this.operator) {
            const opId = this.operator.getName();
            const operatorSymbol = findOverloadedOperator(context, opId, (
                symbol => symbol.isBinaryOperator()
                    && symbol.params?.length === 2
                    && getConversionCost(leftType, symbol.params[0].getType()) === 1
                    && getConversionCost(rightType, symbol.params[1].getType()) === 1
            ));
            if (operatorSymbol) {
                this.operator.setRef(operatorSymbol, document);
            }
        }
    }
}

export class UCAssignmentOperatorExpression extends UCBinaryOperatorExpression {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        let leftType: ITypeSymbol;
        if (this.left) {
            this.left.index(document, context, { inAssignment: true });
            leftType = getExpressionTypeSafe(this.left);
        } else {
            leftType = StaticErrorType;
        }

        if (this.right) {
            this.right.index(document, context, {
                contextType: leftType
            });
        }
    }
}

export class UCMemberExpression extends UCExpression {
    public type?: ITypeSymbol;

    constructor(readonly id: Identifier) {
        super(id.range);
    }

    getMemberSymbol() {
        return this.type?.getRef();
    }

    getType() {
        const symbol = this.type?.getRef();
        // We resolve UCMethodSymbols in UCCallExpression, because we don't want to return the function's type in assignment expressions...
        if (symbol) {
            if (isProperty(symbol)) {
                return symbol.getType();
            }

            if (isConstSymbol(symbol)) {
                return symbol.getType();
            }
        }
        return this.type;
    }

    getContainedSymbolAtPos(_position: Position) {
        // Only return if we have a RESOLVED reference.
        return this.type?.getRef() && this.type;
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        const id = this.id.name;

        const contextType = info?.contextType;
        const contextTypeKind = contextType?.getTypeKind();
        if (contextTypeKind === UCTypeKind.Name) {
            const label = context.labels?.[id.hash];
            if (label) {
                const nameType = new UCTypeSymbol(UCTypeKind.Name, this.id.range);
                this.type = nameType;
                return;
            }
        }

        // findSuperSymbol() here also picks up enum tags, thus we don't have to check for a contextTypeKind
        // Note: The UnrealScript compiles this as an integer literal, but as a byte if an enum context was given.
        // We treat both scenarios as a byte.
        let member = isStruct(context) && context.findSuperSymbol(id);
        if (!member) {
            // Look for a context-less enum tag reference, e.g. (myLocalByte === ET_EnumTag)
            // Follow the compilers behavior:
            // - Tags are only visible when we have a context hint that is compatible with an enum.
            if (config.checkTypes) {
                if (contextTypeKind === UCTypeKind.Byte ||
                    contextTypeKind === UCTypeKind.Int ||
                    contextTypeKind === UCTypeKind.Enum) {
                    member = getEnumMember(id);
                }
            } else {
                member = getEnumMember(id);
            }
        }

        if (member) {
            const type = new UCObjectTypeSymbol(this.id);
            const symbolRef = type.setRef(member, document)!;
            if (info) {
                symbolRef.inAssignment = info.inAssignment;
            }
            this.type = type;
        }
    }
}

export class UCDefaultAssignmentExpression extends UCAssignmentOperatorExpression {
    getType() {
        return undefined;
    }
}

/**
 * Resembles "propertyMember.operationMember(arguments)"".
 *
 * @method getMemberSymbol will always return the instance of "operationMember".
 * @method getType will always return the type of instance "propertyMember", because our array operations have no return type.
 */
export class UCDefaultMemberCallExpression extends UCExpression {
    public propertyMember: UCMemberExpression;
    public operationMember: UCObjectTypeSymbol;
    public arguments?: Array<IExpression>;

    getMemberSymbol() {
        return this.operationMember.getRef();
    }

    getType() {
        const type = this.propertyMember.getType();
        if (type && UCArrayTypeSymbol.is(type)) {
            // Resolve metaclass class<Actor> to Actor
            if (hasDefinedBaseType(type) && hasDefinedBaseType(type.baseType)) {
                return type.baseType.baseType;
            }
            return type.baseType;
        }
        return type;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.propertyMember.getSymbolAtPos(position) ?? this.operationMember.getSymbolAtPos(position);
        if (symbol) {
            return symbol;
        }

        if (this.arguments) for (const arg of this.arguments) {
            const symbol = arg.getSymbolAtPos(position);
            if (symbol) {
                return symbol;
            }
        }
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.propertyMember.index(document, context, info);

        const type = this.propertyMember.getType();
        const isArrayType = type && UCArrayTypeSymbol.is(type);
        const methodSymbol = isArrayType
            ? DefaultArray.findSuperSymbol<UCMethodSymbol>(this.operationMember.id.name)
            : undefined;
        if (methodSymbol) {
            this.operationMember.setRef(methodSymbol, document);
        }

        if (!this.arguments) {
            return;
        }

        const typeParameter = isArrayType
            ? type.baseType
            : StaticErrorType;
        if (methodSymbol?.params) {
            const argInfo: ContextInfo = {
                contextType: StaticErrorType,
                inAssignment: false,
            };
            for (let i = 0; i < this.arguments.length; ++i) {
                if (i < methodSymbol.params.length) {
                    const param = methodSymbol.params[i];
                    const paramType = param.getType();
                    argInfo.contextType = paramType === StaticMetaType && typeParameter
                        ? typeParameter
                        : paramType;
                    argInfo.inAssignment = param.hasAnyModifierFlags(ModifierFlags.Out);
                    this.arguments[i].index(document, context, argInfo);
                } else {
                    // * Excessive arguments, we will still index the arguements.
                    this.arguments[i].index(document, context, {
                        contextType: typeParameter,
                        inAssignment: false
                    });
                }
            }
        } else {
            if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
                this.arguments[i].index(document, context, {
                    contextType: typeParameter,
                    inAssignment: false
                });
            }
        }
    }
}

/**
 * Represents an identifier in a defaultproperties block. e.g. "Class=ClassName", here "ClassName" would be represented by this expression.
 **/
export class UCIdentifierLiteralExpression extends UCMemberExpression {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        if (this.type) {
            this.type.index(document, context, info);
            return;
        }

        // Default assignments are context sensitive, we can't accurately lookup anything if the type is unresolved.
        if (!info || !info.contextType) {
            return;
        }
        const kind: UCTypeKind = info.contextType.getTypeKind();
        if (kind === UCTypeKind.Error) {
            return;
        }

        // TODO: Const precedence?

        const name = this.id.name;
        let member: UCObjectSymbol | undefined;
        switch (kind) {
            case UCTypeKind.Byte:
            case UCTypeKind.Int:
            case UCTypeKind.Enum:
                // FIXME: Constants should take precedence
                member = getEnumMember(name);
                break;

            case UCTypeKind.Object:
                member = ObjectsTable.getSymbol(name.hash);
                break;

            case UCTypeKind.Delegate: {
                const classContext = getOuter<UCClassSymbol>(context, UCSymbolKind.Class)!;
                // TODO: Use something else to find a function without the need to check its specification.
                member = classContext.findSuperSymbol(name, UCSymbolKind.Function)
                    ?? classContext.findSuperSymbol(name, UCSymbolKind.Delegate)
                    ?? classContext.findSuperSymbol(name, UCSymbolKind.Event);
                break;
            }

            /**
             * Note: a name identifier takes precedence over a const that may have a name literal.
             * e.g.
             * const myName = 'myConstName';
             * literalName=myName
             * Will be resolved as 'myName' instead of 'myConstName'
             */
            case UCTypeKind.Name: {
                const type = new UCTypeSymbol(UCTypeKind.Name, this.id.range);
                this.type = type;
                break;
            }

            default: {
                // Pickup const variables...
                const classContext = getOuter<UCClassSymbol>(context, UCSymbolKind.Class);
                console.assert(classContext, 'No class context for defaultproperties block!', context.getPath());
                member = classContext?.findSuperSymbol(name, UCSymbolKind.Const);
                break;
            }
        }

        if (member) {
            const type = new UCObjectTypeSymbol(this.id);
            const ref = type.setRef(member, document)!;
            if (info) {
                ref.inAssignment = info.inAssignment;
            }
            this.type = type;
        }
    }
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCExpression {
    constructor(readonly id: Identifier, public typeRef = new UCObjectTypeSymbol(id)) {
        super(id.range);
    }

    getMemberSymbol() {
        return this.typeRef?.getRef();
    }

    getType() {
        return this.typeRef;
    }

    getContainedSymbolAtPos(_position: Position) {
        return this.typeRef.getRef() && this.typeRef;
    }

    index(document: UCDocument, _context?: UCStructSymbol) {
        this.typeRef.setRefNoIndex(document.class);
    }
}

// Resolves the context for predefined specifiers such as (default, static, and const).
export class UCPropertyClassAccessExpression extends UCPropertyAccessExpression {

}

export class UCSuperExpression extends UCExpression {
    public structTypeRef?: UCObjectTypeSymbol;

    // Resolved structRef.
    private superStruct?: UCStructSymbol;

    getMemberSymbol() {
        return this.superStruct;
    }

    getType() {
        return this.structTypeRef;
    }

    getContainedSymbolAtPos(position: Position) {
        if (this.structTypeRef?.getSymbolAtPos(position)) {
            return this.structTypeRef;
        }
    }

    index(document: UCDocument, context: UCStructSymbol) {
        context = (isFunction(context) && context.outer && isStateSymbol(context.outer) && context.outer.super)
            ? context.outer
            : document.class!;

        if (this.structTypeRef) {
            // FIXME: UE2 doesn't verify inheritance, thus particular exploits are possible by calling a super function through an unrelated class,
            // -- this let's programmers write data in different parts of the memory.
            // -- Thus should we just be naive and match any type instead?
            const symbol = findSuperStruct(context, this.structTypeRef.getName()) ?? tryFindClassSymbol(this.structTypeRef.getName());
            if (isStruct(symbol)) {
                this.structTypeRef.setRef(symbol, document);
                this.superStruct = symbol;
            }
        } else {
            this.superStruct = context.super;
            if (this.superStruct) {
                const type = new UCObjectTypeSymbol(this.superStruct.id, undefined, UCSymbolKind.Field);
                type.setRef(this.superStruct, document);
                this.structTypeRef = type;
            }
        }
    }
}

export class UCNewExpression extends UCCallExpression {
    // TODO: Implement pseudo new operator for hover info?
}

export abstract class UCLiteral implements IExpression {
    readonly kind = UCNodeKind.Expression;

    constructor(protected range: Range) {
    }

    getRange(): Range {
        return this.range;
    }

    getSymbolAtPos(position: Position): ISymbol | undefined {
        if (!intersectsWith(this.getRange(), position)) {
            return undefined;
        }
        const symbol = this.getContainedSymbolAtPos(position);
        return symbol;
    }

    getMemberSymbol(): ISymbol | undefined {
        return undefined;
    }

    getContainedSymbolAtPos(position: Position): ISymbol | undefined {
        return undefined;
    }

    getType(): ITypeSymbol | undefined {
        return undefined;
    }

    getValue(): number | undefined {
        return undefined;
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        //
    }

    accept<Result>(visitor: SymbolWalker<Result>): Result | void {
        return visitor.visitExpression(this);
    }
}

export class UCNoneLiteral extends UCLiteral {
    getType() {
        return StaticNoneType;
    }

    toString() {
        return 'None';
    }
}

export class UCStringLiteral extends UCLiteral {
    getType() {
        return StaticStringType;
    }

    toString() {
        return '""';
    }
}

export class UCNameLiteral extends UCLiteral {
    constructor(readonly id: Identifier) {
        super(id.range);
    }

    getType() {
        return StaticNameType;
    }

    toString() {
        return `'${this.id.name.text}'`;
    }
}

export class UCBoolLiteral extends UCLiteral {
    value: boolean;

    getType() {
        return StaticBoolType;
    }

    toString() {
        return String(this.value);
    }
}

export class UCFloatLiteral extends UCLiteral {
    value: number;

    getType() {
        return StaticFloatType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCIntLiteral extends UCLiteral {
    value: number;

    getType() {
        return StaticIntType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCByteLiteral extends UCLiteral {
    value: number;

    getType() {
        return StaticByteType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCObjectLiteral extends UCLiteral {
    public castRef: UCObjectTypeSymbol;
    public objectRef?: UCObjectTypeSymbol | UCQualifiedTypeSymbol;

    getMemberSymbol() {
        return this.objectRef?.getRef() ?? this.castRef.getRef();
    }

    getType() {
        return this.objectRef ?? this.castRef;
    }

    getContainedSymbolAtPos(position: Position) {
        if (intersectsWith(this.castRef.getRange(), position)) {
            return this.castRef.getRef() && this.castRef;
        }
        return this.objectRef?.getSymbolAtPos(position);
    }

    index(document: UCDocument, context: UCStructSymbol) {
        const castClass = tryFindClassSymbol(this.castRef.id.name);
        if (castClass) {
            this.castRef.setRef(castClass, document);
            if (this.objectRef) {
                if (UCQualifiedTypeSymbol.is(this.objectRef)) {
                    for (let next: UCQualifiedTypeSymbol | undefined = this.objectRef; next; next = next.left) {
                        let symbol: ISymbol | undefined;
                        if (next.left) {
                            const hash = getSymbolOuterHash(getSymbolHash(next), getSymbolHash(next.left));
                            symbol = OuterObjectsTable.getSymbol(hash, castClass.kind);
                        } else {
                            const hash = getSymbolHash(next);
                            symbol = ObjectsTable.getSymbol<UCPackage>(hash, UCSymbolKind.Package);
                        }
                        if (symbol) {
                            next.type.setRef(symbol, document);
                        }
                    }
                } else {
                    const id = this.objectRef.getName();
                    const symbol = ObjectsTable.getSymbol(id, castClass.kind)
                        ?? findOrIndexClassSymbol(id)
                        // FIXME: Hacky case for literals like Property'TempColor', only enums and structs are added to the objects table.
                        ?? context.findSuperSymbol(id);
                    if (symbol) {
                        this.objectRef.setRef(symbol, document);
                    }
                }
            }
        }
    }
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCLiteral {
    structType!: UCObjectTypeSymbol;

    getMemberSymbol() {
        return this.structType.getRef();
    }

    getType() {
        return this.structType;
    }

    getContainedSymbolAtPos(_position: Position) {
        // Only return if we have a RESOLVED reference.
        return this.structType.getRef() && this.structType as ISymbol;
    }

    index(_document: UCDocument, _context?: UCStructSymbol) {
        if (this.structType.getRef()) {
            return;
        }

        const symbol = ObjectsTable.getSymbol<UCStructSymbol>(this.structType.getName(), UCSymbolKind.ScriptStruct, CORE_PACKAGE);
        this.structType.setRefNoIndex(symbol);
    }
}

export class UCDefaultStructLiteral extends UCExpression {
    public arguments?: Array<IExpression | undefined>;

    getContainedSymbolAtPos(position: Position) {
        if (this.arguments) for (const arg of this.arguments) {
            const symbol = arg?.getSymbolAtPos(position);
            if (symbol) {
                return symbol;
            }
        }
    }

    index(document: UCDocument, context?: UCStructSymbol) {
        if (this.arguments) for (const arg of this.arguments) {
            arg?.index(document, context);
        }
    }
}

export class UCVectLiteral extends UCStructLiteral {
    structType = StaticVectorType;

    getContainedSymbolAtPos(_position: Position) {
        return IntrinsicVectLiteral;
    }
}

export class UCRotLiteral extends UCStructLiteral {
    structType = StaticRotatorType;

    getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRotLiteral;
    }
}

export class UCRngLiteral extends UCStructLiteral {
    structType = StaticRangeType;

    getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRngLiteral;
    }
}

export class UCSizeOfLiteral extends UCLiteral {
    public argumentRef?: ITypeSymbol;

    getValue() {
        // FIXME: We don't have the data to calculate a class's size.
        // const symbol = this.argumentRef?.getReference();
        return undefined;
    }

    getType() {
        return this.argumentRef;
    }

    getContainedSymbolAtPos(position: Position) {
        return this.argumentRef?.getSymbolAtPos(position) && this.argumentRef;
    }

    index(document: UCDocument, context?: UCStructSymbol) {
        super.index(document, context);
        this.argumentRef?.index(document, context!);
    }
}

export class UCMetaClassExpression extends UCExpression {
    public classRef?: UCObjectTypeSymbol;
    public expression?: IExpression;

    getMemberSymbol() {
        return this.classRef?.getRef();
    }

    getType() {
        return this.classRef;
    }

    getContainedSymbolAtPos(position: Position) {
        const subSymbol = this.classRef?.getSymbolAtPos(position) as UCObjectTypeSymbol;
        return this.expression?.getSymbolAtPos(position) ?? (subSymbol?.getRef() && this.classRef);
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.classRef?.index(document, context!);
        this.expression?.index(document, context, info);
    }
}

function getExpressionTypeSafe(expr: IExpression): ITypeSymbol {
    return expr.getType() ?? StaticErrorType;
}