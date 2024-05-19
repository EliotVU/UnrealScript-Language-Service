import { Position, Range } from 'vscode-languageserver';

import { Token } from 'antlr4ts/Token';
import {
    CORE_PACKAGE,
    CastTypeSymbolMap,
    ContextInfo,
    DefaultArray,
    INode,
    ISymbol,
    ITypeSymbol,
    IWithIndex,
    IWithInnerSymbols,
    Identifier,
    IntrinsicClass,
    IntrinsicObject,
    IntrinsicRngLiteral,
    IntrinsicRotLiteral,
    IntrinsicRotator,
    IntrinsicScriptStruct,
    IntrinsicVectLiteral,
    IntrinsicVector,
    ModifierFlags,
    ObjectsTable,
    OuterObjectsTable,
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
    UCArrayTypeSymbol,
    UCBaseOperatorSymbol,
    UCClassSymbol,
    UCEnumSymbol,
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
    findOverloadedBinaryOperator,
    findOverloadedPostOperator,
    findOverloadedPreOperator,
    findSuperStruct,
    getContext,
    getOuter,
    getSymbolHash,
    getSymbolOuterHash,
    hasDefinedBaseType,
    areIdentityMatch,
    isArchetypeSymbol,
    isConstSymbol,
    isFunction,
    isOperator,
    isProperty,
    isStateSymbol,
    isStruct,
    resolveType,
    tryFindClassSymbol,
    IntrinsicVectorHash,
    IntrinsicRotatorHash,
    StaticDelegateType,
    UCDelegateSymbol,
} from './Symbols';
import { UCDocument } from './document';
import { intersectsWith } from './helpers';
import { config, getConstSymbol, getEnumMember } from './indexer';
import { NAME_CLASS, NAME_OUTER, NAME_ROTATOR, NAME_STRUCT, NAME_VECTOR } from './names';
import { SymbolWalker } from './symbolWalker';

export interface IExpression extends INode, IWithIndex, IWithInnerSymbols {
    getRange(): Range;
    getMemberSymbol(): ISymbol | undefined;
    // TODO: Refactor to never return undefined, always return a StaticErrorType instead.
    getType(): ITypeSymbol | undefined;
    getSymbolAtPos(position: Position): ISymbol | undefined;
    getValue(): number | boolean | string | undefined;

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

    override getValue() {
        const symbol = this.argument?.getMemberSymbol();
        return symbol && isProperty(symbol) && symbol.getArrayDimSize() || undefined;
    }

    override getMemberSymbol() {
        return this.argument?.getMemberSymbol();
    }

    override getType() {
        return StaticIntType;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.argument?.getSymbolAtPos(position);
        return symbol;
    }

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.argument?.index(document, context, info);
    }
}

export class UCNameOfExpression extends UCExpression {
    public argument?: IExpression;

    override getMemberSymbol() {
        return this.argument?.getMemberSymbol();
    }

    override getType() {
        return StaticNameType;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.argument?.getSymbolAtPos(position);
        return symbol;
    }

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.argument?.index(document, context, info);
    }
}

export class UCEmptyArgument extends UCExpression {
    getContainedSymbolAtPos(_position: Position): undefined {
        return undefined;
    }
}

export class UCCallExpression extends UCExpression {
    public expression: IExpression;
    public arguments?: Array<IExpression>;

    override getMemberSymbol() {
        return this.expression.getMemberSymbol();
    }

    override getType() {
        const type = this.expression.getType();
        if (!type) {
            return undefined;
        }

        let symbol = type.getRef();
        // HACK: Resolve to baseType's reference for delegate property calls
        // Not sure why this was designed in such a way, let's deal with that later.
        if (symbol === StaticDelegateType && hasDefinedBaseType(type)) {
            symbol = type.baseType.getRef<UCDelegateSymbol>();
        }

        if (symbol && isFunction(symbol)) {
            const returnValue = symbol.returnValue;
            if (returnValue) {
                // Coerce the return type to match that of the first passed argument, e.g. "coerce Object Spawn(class'Actor' actor);"
                if (returnValue.hasAnyModifierFlags(ModifierFlags.Coerce) && this.arguments && this.arguments.length > 0) {
                    const firstArgumentType = this.arguments[0].getType();
                    return firstArgumentType && resolveType(firstArgumentType);
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

        return undefined;
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        if (!this.arguments?.length) {
            this.expression.index(document, context);
            return;
        }

        // Let's perform the indexing of the UCMemberExpression ourselves if some parameters are met.
        // 1. Match a primitive (int, byte, etc) or vector/rotator cast regardless of the total count of arguments and type.
        // 2. If false, try match a class, and verify that we have only one argument that is also of type 'Object'
        // 3. If false, try match an enum and verify that we have only one argument that is also of type 'Byte'
        let type: ITypeSymbol | undefined;
        if (this.expression instanceof UCMemberExpression) {
            const name = this.expression.id.name;
            if ((type = CastTypeSymbolMap.get(name))) {
                this.expression.type = type;
            } else if (name === NAME_VECTOR) {
                type = new UCObjectTypeSymbol(this.expression.id);
                // Try work with the declared native struct instead of the intrinsic struct. (so that Vector(MyVec).X will resolve properly, as well as go to definition)
                // Fall back to the intrinsic struct for situations where we have no Object.uc in the workspace.
                const nativeStruct = OuterObjectsTable.getSymbol(IntrinsicVectorHash, UCSymbolKind.ScriptStruct) ?? IntrinsicVector;
                (type as UCObjectTypeSymbol).setRef(nativeStruct, document);
                this.expression.type = type;
            } else if (name === NAME_ROTATOR) {
                type = new UCObjectTypeSymbol(this.expression.id);
                const nativeStruct = OuterObjectsTable.getSymbol(IntrinsicRotatorHash, UCSymbolKind.ScriptStruct) ?? IntrinsicRotator;
                (type as UCObjectTypeSymbol).setRef(nativeStruct, document);
                this.expression.type = type;
            } else if (name === NAME_STRUCT) {
                type = new UCObjectTypeSymbol(this.expression.id);
                (type as UCObjectTypeSymbol).setRef(IntrinsicScriptStruct, document);
                this.expression.type = type;
            } else if (this.arguments.length === 1) {
                this.arguments[0].index(document, context, {
                    contextType: StaticErrorType,
                    inAssignment: false
                });

                const sourceTypeKind = this.arguments[0].getType()?.getTypeKind();
                switch (sourceTypeKind) {
                    case UCTypeKind.Object: {
                        const classSymbol = tryFindClassSymbol(name);
                        if (classSymbol) {
                            type = new UCObjectTypeSymbol(this.expression.id);
                            (type as UCObjectTypeSymbol).setRef(classSymbol, document);
                            this.expression.type = type;
                        }
                        break;
                    }

                    case UCTypeKind.Byte: {
                        const enumSymbol = ObjectsTable.getSymbol<UCEnumSymbol>(name, UCSymbolKind.Enum);
                        if (enumSymbol) {
                            type = new UCObjectTypeSymbol(this.expression.id);
                            (type as UCObjectTypeSymbol).setRef(enumSymbol, document);
                            this.expression.type = type;
                        }
                        break;
                    }
                }
            }
        }

        // Could still be a valid function call, so fallback to the default indexing behavior.
        if (typeof type === 'undefined') {
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
                        // * Excessive arguments, we will still index the arguments.
                        this.arguments[i].index(document, context, {
                            contextType: StaticErrorType,
                            inAssignment: false
                        });
                    }
                }
            } else {
                // * Excessive arguments, we will still index the arguments.
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

    override getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    // Returns the type we are working with after [] has taken affect, this means we return undefined if the type is invalid.
    override getType() {
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

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
        this.argument?.index(document, context, info);
    }
}

export class UCDefaultElementAccessExpression extends UCElementAccessExpression {
    declare expression: UCMemberExpression;

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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

    override getMemberSymbol() {
        return this.member?.getMemberSymbol();
    }

    override getType() {
        return this.member?.getType();
    }

    getContainedSymbolAtPos(position: Position) {
        return this.member?.getSymbolAtPos(position) ?? this.left.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
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

    override getMemberSymbol() {
        return this.true?.getMemberSymbol();
    }

    override getType() {
        return this.true?.getType();
    }

    getContainedSymbolAtPos(position: Position) {
        return this.condition.getSymbolAtPos(position)
            ?? this.true?.getSymbolAtPos(position)
            ?? this.false?.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.condition.index(document, context, info);
        this.true?.index(document, context, info);
        this.false?.index(document, context, info);
    }
}

export abstract class UCBaseOperatorExpression extends UCExpression {
    public expression: IExpression;
    public operator: UCObjectTypeSymbol;

    override getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    override getType() {
        const operatorSymbol = this.operator.getRef();
        if (operatorSymbol && isOperator(operatorSymbol)) {
            return operatorSymbol.getType();
        }

        return undefined;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.operator.getSymbolAtPos(position);
        if (symbol && this.operator.getRef()) {
            return symbol;
        }
        return this.expression.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.expression.index(document, context, info);
    }
}

export class UCPostOperatorExpression extends UCBaseOperatorExpression {
    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.operator && this.expression) {
            const inputType = this.expression.getType();
            if (inputType) {
                const operatorName = this.operator.getName();
                const operatorSymbol = findOverloadedPostOperator(context, operatorName, inputType);
                if (operatorSymbol) {
                    this.operator.setRef(operatorSymbol, document);
                }
            }
        }
    }
}

export class UCPreOperatorExpression extends UCBaseOperatorExpression {
    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        super.index(document, context, info);
        if (this.operator && this.expression) {
            const inputType = this.expression.getType();
            if (inputType) {
                const operatorName = this.operator.getName();
                const operatorSymbol = findOverloadedPreOperator(context, operatorName, inputType);
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

    override getMemberSymbol(): UCBaseOperatorSymbol | undefined {
        return this.operator?.getRef<UCBaseOperatorSymbol>();
    }

    override getType() {
        const operatorSymbol = this.operator?.getRef();
        if (operatorSymbol && isFunction(operatorSymbol) && operatorSymbol.isBinaryOperator()) {
            return operatorSymbol.getType();
        }

        return undefined;
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.operator?.getSymbolAtPos(position);
        if (symbol && this.operator!.getRef()) {
            return symbol;
        }
        return this.left?.getSymbolAtPos(position) ?? this.right?.getSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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
            const operatorSymbol = findOverloadedBinaryOperator(context, opId, leftType, rightType);
            if (operatorSymbol) {
                this.operator.setRef(operatorSymbol, document);
            }
        }
    }
}

export class UCAssignmentOperatorExpression extends UCBinaryOperatorExpression {
    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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
    private coercedType?: ITypeSymbol;

    constructor(readonly id: Identifier) {
        super(id.range);
    }

    override getMemberSymbol() {
        if (this.coercedType) {
            return this.coercedType.getRef();
        }

        return this.type?.getRef();
    }

    override getType() {
        if (this.coercedType) {
            return this.coercedType;
        }

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
        if (this.coercedType) {
            return this.coercedType;
        }

        // Only return if we have a RESOLVED reference.
        return this.type?.getRef() && this.type;
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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
        } else if (member.getName() === NAME_CLASS && areIdentityMatch(member.outer, IntrinsicObject)) {
            const classContext = getContext<UCClassSymbol>(context, UCSymbolKind.Class)!;
            const coercedType = new UCObjectTypeSymbol(this.id);
            coercedType.setRefNoIndex(classContext);
            this.coercedType = coercedType;
        } else if (member.getName() === NAME_OUTER && areIdentityMatch(member.outer, IntrinsicObject)) {
            const classContext = getContext<UCClassSymbol>(context, UCSymbolKind.Class)!;
            this.coercedType = classContext.withinType;
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
    override getType(): undefined {
        return undefined;
    }
}

export class UCObjectAttributeExpression extends UCDefaultAssignmentExpression {

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

    override getMemberSymbol() {
        return this.operationMember.getRef();
    }

    override getType() {
        const type = this.propertyMember.getType();
        if (type && UCArrayTypeSymbol.is(type)) {
            // Resolve metaclass class<Actor> to Actor
            // Commented out because it was causing issues with type compatibility checks, TODO: Figure out if this resolve matters anymore.
            // if (hasDefinedBaseType(type) && hasDefinedBaseType(type.baseType)) {
            //     return type.baseType.baseType;
            // }
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

        return undefined;
    }

    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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
                    // * Excessive arguments, we will still index the arguments.
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
    override index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
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

        const name = this.id.name;
        let member: UCObjectSymbol | undefined;
        switch (kind) {
            case UCTypeKind.Enum: {
                // Search is restricted to the property enum's tags
                const enumSymbol = info.contextType.getRef<UCEnumSymbol>()!;
                member = enumSymbol.getSymbol(name);
                break;
            }

            case UCTypeKind.Int:
                // UE3 behavior, a name can match with any object outside of the current scope. 
                member = getConstSymbol(name) ?? getEnumMember(name);
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

            case UCTypeKind.Name: {
                const type = new UCTypeSymbol(UCTypeKind.Name, this.id.range);
                this.type = type;
                break;
            }
        }

        // Fall back to a constants search within the current class or the subobject's class.
        // FIXME: Technically, we should also look for a constant even if we have a defined @member, if the defined member is also incompatible.
        if (!member && kind !== UCTypeKind.Delegate) {
            const classContext = getOuter<UCClassSymbol>(context, UCSymbolKind.Class)!;
            console.assert(classContext, 'No class context for defaultproperties block!', context.getPath());

            member = classContext.findSuperSymbol(name, UCSymbolKind.Const);
            // Search within the subobject's class
            if (!member && isArchetypeSymbol(context)) {
                member = context.findSuperSymbol(name, UCSymbolKind.Const);
            }
        }

        // All searches have failed.
        if (!member) {
            return;
        }

        const type = new UCObjectTypeSymbol(this.id);
        const ref = type.setRef(member, document)!;
        if (info) {
            ref.inAssignment = info.inAssignment;
        }
        this.type = type;
    }
}

// Resolves the member for predefined specifiers such as (self, default, static, and global)
export class UCPredefinedAccessExpression extends UCExpression {
    constructor(readonly id: Identifier, public typeRef = new UCObjectTypeSymbol(id)) {
        super(id.range);
    }

    override getMemberSymbol() {
        return this.typeRef?.getRef();
    }

    override getType() {
        return this.typeRef;
    }

    getContainedSymbolAtPos(_position: Position) {
        return this.typeRef.getRef() && this.typeRef;
    }

    override index(document: UCDocument, _context?: UCStructSymbol) {
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

    override getMemberSymbol() {
        return this.superStruct;
    }

    override getType() {
        return this.structTypeRef;
    }

    getContainedSymbolAtPos(position: Position) {
        if (this.structTypeRef?.getSymbolAtPos(position)) {
            return this.structTypeRef;
        }

        return undefined;
    }

    override index(document: UCDocument, context: UCStructSymbol) {
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

    /**
     * Gets the type of the class expression
     * 
     * @returns The resolved type of the class expression
     */
    override getType() {
        const type = this.expression.getType();
        // We need to resolve the type to its `baseType`, because we expect expressions to work with the object reference instead.
        // e.g. assigning a new object of class type to Foo: `Foo = new (None) Class'MyClass'` 
        // in this example Foo needs to be an object reference with the class type `MyClass`
        return type && resolveType(type);
    }
}

export abstract class UCLiteral implements IExpression {
    readonly kind = UCNodeKind.Expression;

    constructor(protected range: Range, protected valueToken?: Token) {
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

    getValue(): number | boolean | string | undefined {
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
    override getType() {
        return StaticNoneType;
    }

    override getValue() {
        return 'None';
    }

    override toString() {
        return this.getValue();
    }
}

export class UCStringLiteral extends UCLiteral {
    declare valueToken: Token;

    override getType() {
        return StaticStringType;
    }

    override getValue() {
        return `${this.valueToken.text!}[${this.valueToken.text!.length - 2}]`;
    }

    override toString() {
        return this.getValue();
    }
}

export class UCNameLiteral extends UCLiteral {
    constructor(readonly id: Identifier) {
        super(id.range);
    }

    override getType() {
        return StaticNameType;
    }

    override getValue() {
        return `'${this.id.name.text}'`;
    }

    override toString() {
        return this.getValue();
    }
}

export class UCBoolLiteral extends UCLiteral {
    declare valueToken: Token;

    override getType() {
        return StaticBoolType;
    }

    override getValue() {
        return Boolean(this.valueToken.text!);
    }

    override toString() {
        return String(this.getValue());
    }
}

export class UCFloatLiteral extends UCLiteral {
    declare valueToken: Token;

    override getType() {
        return StaticFloatType;
    }

    override getValue(): number {
        return Number.parseFloat(this.valueToken.text!);
    }
}

export class UCIntLiteral extends UCLiteral {
    declare valueToken: Token;

    override getType() {
        return StaticIntType;
    }

    override getValue(): number {
        return Number.parseInt(this.valueToken.text!);
    }
}

export class UCByteLiteral extends UCLiteral {
    declare valueToken: Token;

    override getType() {
        return StaticByteType;
    }

    override getValue(): number {
        return Number.parseInt(this.valueToken.text!);
    }
}

/** Represents an expression like: ClassName'ObjectReferencePath' e.g. Class'Core.Object', Struct'Core.Object.Vector' */
export class UCObjectLiteral extends UCLiteral {
    /** 
     * The class specifier in the literal, i.e. Class for Class'MyClass'.
     * @property classRef.baseType should represent the object reference. 
     **/
    public classRef: UCObjectTypeSymbol<UCQualifiedTypeSymbol | UCObjectTypeSymbol>;

    override getMemberSymbol() {
        return this.classRef.baseType?.getRef() ?? this.classRef.getRef();
    }

    override getType() {
        return this.classRef;
    }

    override getContainedSymbolAtPos(position: Position) {
        return this.classRef.getContainedSymbolAtPos(position);
    }

    override index(document: UCDocument, context: UCStructSymbol) {
        const classSymbol = tryFindClassSymbol(this.classRef.id.name);
        if (!classSymbol) {
            return;
        }

        this.classRef.setRef(classSymbol, document);

        const objectRefType = this.classRef.baseType;
        if (!objectRefType) {
            return;
        }

        // TODO: Implement StaticClass logic, so we can properly fetch the correct object by hash.

        if (UCQualifiedTypeSymbol.is(objectRefType)) {
            for (let next: UCQualifiedTypeSymbol | undefined = objectRefType; next; next = next.left) {
                let symbol: ISymbol | undefined;
                if (next.left) {
                    const hash = getSymbolOuterHash(getSymbolHash(next), getSymbolHash(next.left));
                    symbol = OuterObjectsTable.getSymbol(hash, classSymbol.kind);
                } else {
                    const hash = getSymbolHash(next);
                    symbol = ObjectsTable.getSymbol<UCPackage>(hash, UCSymbolKind.Package);
                }
                if (symbol) {
                    next.type.setRef(symbol, document);
                }
            }

            return;
        }

        let symbol: ISymbol | undefined = undefined;

        const objectName = objectRefType.getName();
        symbol = tryFindClassSymbol(objectName)
            ?? ObjectsTable.getSymbol(objectName, classSymbol.kind)
            // FIXME: Hacky case for literals like Property'TempColor', only enums and structs are added to the objects table.
            ?? context.findSuperSymbol(objectName);

        if (symbol) {
            objectRefType.setRef(symbol, document);
        }
    }

    override getValue() {
        const classRef = this.classRef.getRef();
        if (typeof classRef === 'undefined') {
            return 'None';
        }

        const objectRef = this.classRef.baseType?.getRef();
        return `${this.classRef.getName().text}'${objectRef?.getPath() ?? 'None'}'`;
    }

    override toString() {
        return String(this.getValue());
    }
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCLiteral {
    structType!: UCObjectTypeSymbol;

    override getMemberSymbol() {
        return this.structType.getRef();
    }

    override getType() {
        return this.structType;
    }

    override getContainedSymbolAtPos(_position: Position) {
        // Only return if we have a RESOLVED reference.
        return this.structType.getRef() && this.structType as ISymbol;
    }

    override index(_document: UCDocument, _context?: UCStructSymbol) {
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

        return undefined;
    }

    override index(document: UCDocument, context?: UCStructSymbol) {
        if (this.arguments) for (const arg of this.arguments) {
            arg?.index(document, context);
        }
    }
}

export class UCVectLiteral extends UCStructLiteral {
    override structType = StaticVectorType;

    override getContainedSymbolAtPos(_position: Position) {
        return IntrinsicVectLiteral;
    }
}

export class UCRotLiteral extends UCStructLiteral {
    override structType = StaticRotatorType;

    override getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRotLiteral;
    }
}

export class UCRngLiteral extends UCStructLiteral {
    override structType = StaticRangeType;

    override getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRngLiteral;
    }
}

export class UCSizeOfLiteral extends UCLiteral {
    public argumentRef?: ITypeSymbol;

    override getValue(): undefined {
        // FIXME: We don't have the data to calculate a class's size.
        // const symbol = this.argumentRef?.getReference();
        return undefined;
    }

    override getType() {
        return this.argumentRef;
    }

    override getContainedSymbolAtPos(position: Position) {
        return this.argumentRef?.getSymbolAtPos(position) && this.argumentRef;
    }

    override index(document: UCDocument, context?: UCStructSymbol) {
        super.index(document, context);
        this.argumentRef?.index(document, context!);
    }
}

export class UCMetaClassExpression extends UCExpression {
    public classRef?: UCObjectTypeSymbol;
    public expression?: IExpression;

    override getMemberSymbol() {
        return this.classRef?.getRef();
    }

    override getType() {
        return this.classRef;
    }

    getContainedSymbolAtPos(position: Position) {
        const subSymbol = this.classRef?.getSymbolAtPos(position) as UCObjectTypeSymbol;
        return this.expression?.getSymbolAtPos(position) ?? (subSymbol?.getRef() && this.classRef);
    }

    override index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.classRef?.index(document, context!);
        this.expression?.index(document, context, info);
    }
}

function getExpressionTypeSafe(expr: IExpression): ITypeSymbol {
    return expr.getType() ?? StaticErrorType;
}
