import { Position, Range } from 'vscode-languageserver';

import { UCDocument } from './document';
import { intersectsWith } from './helpers';
import { config, getEnumMember } from './indexer';
import {
    CastTypeSymbolMap, ContextInfo, CORE_PACKAGE, DefaultArray, EnumCoerceFlags,
    findOrIndexClassSymbol, findSuperStruct, findSymbol, getSymbolHash, getSymbolOuterHash,
    hasDefinedBaseType, Identifier, IntrinsicClass, IntrinsicRngLiteral, IntrinsicRotLiteral,
    IntrinsicVectLiteral, isConstSymbol, isMethodSymbol, isPropertySymbol, isStateSymbol, ISymbol,
    ITypeSymbol, ModifierFlags, ObjectsTable, OuterObjectsTable, resolveType, StaticBoolType,
    StaticByteType, StaticFloatType, StaticIntType, StaticNameType, StaticNoneType, StaticRangeType,
    StaticRotatorType, StaticStringType, StaticVectorType, tryFindClassSymbol, typeMatchesFlags,
    UCArrayTypeSymbol, UCBaseOperatorSymbol, UCNameTypeSymbol, UCObjectTypeSymbol, UCPackage,
    UCQualifiedTypeSymbol, UCStructSymbol, UCSymbol, UCSymbolReference, UCTypeFlags
} from './Symbols';
import { SymbolWalker } from './symbolWalker';

export interface IExpression {
    getRange(): Range;
    getMemberSymbol(): ISymbol | undefined;
    getType(): ITypeSymbol | undefined;
    getSymbolAtPos(position: Position): ISymbol | undefined;
    getValue(): number | undefined;

    // TODO: Consider using visitor pattern to index.
    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo): void;
    accept<Result>(visitor: SymbolWalker<Result>): Result | void;
}

export abstract class UCExpression implements IExpression {
    constructor(protected range: Range) {
    }

    getRange(): Range {
        return this.range;
    }

    getMemberSymbol(): ISymbol | undefined {
        return undefined;
    }

    getType(): ITypeSymbol | undefined {
        return undefined;
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

export class UCParenthesizedExpression extends UCExpression {
    public expression?: IExpression;

    getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    getType() {
        return this.expression?.getType();
    }

    getContainedSymbolAtPos(position: Position) {
        const symbol = this.expression?.getSymbolAtPos(position);
        return symbol;
    }

    index(document: UCDocument, context?: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
    }
}

export class UCArrayCountExpression extends UCExpression {
    public argument?: IExpression;

    getValue() {
        const symbol = this.argument?.getMemberSymbol();
        return symbol && isPropertySymbol(symbol) && symbol.getArrayDimSize() || undefined;
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
    public expression!: IExpression;
    public arguments?: Array<IExpression>;

    getMemberSymbol() {
        return this.expression.getMemberSymbol();
    }

    getType() {
        const type = this.expression.getType();
        const symbol = type?.getRef();
        if (symbol && isMethodSymbol(symbol)) {
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
        // Note: Intentionally passing a clean info object.
        this.expression.index(document, context, {
            hasArguments: this.expression instanceof UCMemberExpression
        });

        const type = this.expression.getType();
        const symbol = type?.getRef();
        if (symbol && isMethodSymbol(symbol)) {
            if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
                const arg = this.arguments[i];
                const param = symbol.params?.[i];
                const expectedFlags = param?.getType()?.getTypeFlags() ?? UCTypeFlags.Error;
                arg.index(document, context, {
                    typeFlags: expectedFlags,
                    inAssignment: param ? param.hasAnyModifierFlags(ModifierFlags.Out) : undefined
                });
            }
        } else {
            // TODO: Handle call on array??
            if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
                const arg = this.arguments[i];
                arg.index(document, context, info);
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
            if (symbol && isPropertySymbol(symbol) && symbol.isFixedArray()) {
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
    override expression: UCMemberExpression;

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        this.expression?.index(document, context, info);
        // this.argument?.index(document, context, info);

        if (this.argument && this.argument instanceof UCIdentifierLiteralExpression) {
            const id = this.argument.id;
            const symbol = (context instanceof UCStructSymbol && context.findSuperSymbol(id.name)) ?? getEnumMember(id.name);
            if (symbol) {
                const type = new UCObjectTypeSymbol(id);
                type.setReference(symbol, document);
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
            if (memberContext instanceof UCStructSymbol) {
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
    public expression!: IExpression;
    public operator!: UCSymbolReference;

    getMemberSymbol() {
        return this.expression?.getMemberSymbol();
    }

    getType() {
        const operatorSymbol = this.operator.getRef();
        if (operatorSymbol instanceof UCBaseOperatorSymbol) {
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
                const operatorSymbol = findSymbol(context, opId, (
                    symbol => isMethodSymbol(symbol)
                        && symbol.isPostOperator()
                        && typeof symbol.params !== 'undefined'
                        && symbol.params.length === 1
                        && typeof symbol.params[0].getType() !== 'undefined'
                        && typeMatchesFlags(symbol.params[0].getType()!, type, symbol.params[0].hasAnyModifierFlags(ModifierFlags.Coerce))
                ));
                if (operatorSymbol) {
                    this.operator.setReference(operatorSymbol, document);
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
                const operatorSymbol = findSymbol(context, opId, (
                    symbol => isMethodSymbol(symbol)
                        && symbol.isPreOperator()
                        && typeof symbol.params !== 'undefined'
                        && symbol.params.length === 1
                        && typeof symbol.params[0].getType() !== 'undefined'
                        && typeMatchesFlags(symbol.params[0].getType()!, type, symbol.params[0].hasAnyModifierFlags(ModifierFlags.Coerce))
                ));
                if (operatorSymbol) {
                    this.operator.setReference(operatorSymbol, document);
                }
            }
        }
    }
}

export class UCBinaryOperatorExpression extends UCExpression {
    public left?: IExpression;
    public operator?: UCSymbolReference;
    public right?: IExpression;

    getMemberSymbol() {
        return this.operator?.getRef();
    }

    getType() {
        const operatorSymbol = this.operator?.getRef();
        if (operatorSymbol && isMethodSymbol(operatorSymbol) && operatorSymbol.isOperator()) {
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

    index(document: UCDocument, context: UCStructSymbol, info: ContextInfo = {}) {
        if (this.left) {
            this.left.index(document, context, info);

            const type = this.left.getType();
            info.typeFlags = type?.getTypeFlags();
        }
        this.right?.index(document, context, info);

        if (this.operator) {
            const leftType = this.left?.getType();
            const rightType = this.right?.getType();
            if (leftType && rightType) {
                const opId = this.operator.getName();
                const operatorSymbol = findSymbol(context, opId, (
                    symbol => isMethodSymbol(symbol)
                        && symbol.isOperator()
                        && typeof symbol.params !== 'undefined'
                        && symbol.params.length === 2
                        && typeof symbol.params[0].getType() !== 'undefined'
                        && typeMatchesFlags(symbol.params[0].getType()!, leftType, symbol.params[0].hasAnyModifierFlags(ModifierFlags.Coerce))
                        && typeof symbol.params[1].getType() !== 'undefined'
                        && typeMatchesFlags(symbol.params[1].getType()!, rightType, symbol.params[1].hasAnyModifierFlags(ModifierFlags.Coerce))
                ));
                if (operatorSymbol) {
                    this.operator.setReference(operatorSymbol, document);
                }
            }
        }
    }
}

export class UCAssignmentOperatorExpression extends UCBinaryOperatorExpression {

}

export class UCDefaultAssignmentExpression extends UCBinaryOperatorExpression {
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
    public operationMember: UCSymbolReference;
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
        if (type && UCArrayTypeSymbol.is(type)) {
            const symbol = DefaultArray.findSuperSymbol(this.operationMember.id.name);
            if (symbol) {
                this.operationMember.setReference(symbol, document);
            }
        }

        if (this.arguments) for (let i = 0; i < this.arguments.length; ++i) {
            const arg = this.arguments[i];
            arg.index(document, context, info);
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
        if (symbol && (isPropertySymbol(symbol) || isConstSymbol(symbol))) {
            return symbol.getType();
        }
        return this.type;
    }

    getContainedSymbolAtPos(_position: Position) {
        // To return static types, but! We are not storing the ranges for primitive casts anyway...
        // if (this.typeRef instanceof UCPredefinedTypeSymbol) {
        // 	return this.typeRef;
        // }
        // Only return if we have a RESOLVED reference.
        return this.type?.getRef() && this.type;
    }

    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        const id = this.id.name;

        if (info && info.typeFlags && info.typeFlags & UCTypeFlags.Name) {
            const label = context.labels?.[id.hash];
            if (label) {
                const nameType = new UCNameTypeSymbol(this.id);
                this.type = nameType;
                return;
            }
        }

        if (info?.hasArguments) {
            // Casting to a int, byte, bool? etc...
            const primitiveType = CastTypeSymbolMap.get(id);
            if (primitiveType) {
                this.type = primitiveType;
                return;
            }

            // Casting to a Class, Struct, or Enum?
            const structSymbol = tryFindClassSymbol(id) || ObjectsTable.getSymbol(id);
            if (structSymbol) {
                const type = new UCObjectTypeSymbol(this.id);
                type.setReference(structSymbol, document);
                this.type = type;
                return;
            }
        }

        let member = context instanceof UCStructSymbol && context.findSuperSymbol(id);
        if (!member && (!config.checkTypes || (info && !info.hasArguments && info.typeFlags && (info.typeFlags & EnumCoerceFlags) !== 0))) {
            member = getEnumMember(id);
        }

        if (member) {
            const type = new UCObjectTypeSymbol(this.id);
            const symbolRef = type.setReference(member, document);
            if (symbolRef && info) {
                symbolRef.inAssignment = info.inAssignment;
            }
            this.type = type;
        }
    }
}

/**
 * Represents an identifier in a defaultproperties block. e.g. "Class=ClassName", here "ClassName" would be represented by this expression.
 **/
export class UCIdentifierLiteralExpression extends UCMemberExpression {
    index(document: UCDocument, context: UCStructSymbol, info?: ContextInfo) {
        if (this.type) {
            this.type.index(document, context);
            return;
        }

        const flags = info?.typeFlags ?? UCTypeFlags.Error;
        if (flags === UCTypeFlags.Error) {
            return;
        }

        // TODO: Const precedence?

        const id = this.id.name;
        let member: UCSymbol | undefined;
        if (flags & EnumCoerceFlags) {
            member = getEnumMember(id);
        } else if (flags & UCTypeFlags.Object) {
            member = context.findSuperSymbol(id);
        } else {
            // Pickup const variables...
            member = context.findSuperSymbol(id);
        }

        if (typeof member !== 'undefined') {
            const type = new UCObjectTypeSymbol(this.id);
            type.setReference(member, document);
            this.type = type;
        } else if (flags & UCTypeFlags.Name) {
            const type = new UCNameTypeSymbol(this.id);
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
        document.class && this.typeRef.setReference(document.class, document, true);
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
        context = (isMethodSymbol(context) && context.outer && isStateSymbol(context.outer) && context.outer.super)
            ? context.outer
            : document.class!;

        if (this.structTypeRef) {
            // FIXME: UE2 doesn't verify inheritance, thus particular exploits are possible by calling a super function through an unrelated class,
            // -- this let's programmers write data in different parts of the memory.
            // -- Thus should we just be naive and match any type instead?
            const symbol = findSuperStruct(context, this.structTypeRef.getName()) || tryFindClassSymbol(this.structTypeRef.getName());
            if (symbol instanceof UCStructSymbol) {
                this.structTypeRef.setReference(symbol, document);
                this.superStruct = symbol;
            }
        } else {
            this.superStruct = context.super;
            if (this.superStruct) {
                const type = new UCObjectTypeSymbol(this.superStruct.id, undefined, UCTypeFlags.Class | UCTypeFlags.State);
                type.setReference(this.superStruct, document, false);
                this.structTypeRef = type;
            }
        }
    }
}

export class UCNewExpression extends UCCallExpression {
    // TODO: Implement pseudo new operator for hover info?
}

export abstract class UCLiteral extends UCExpression {
    getContainedSymbolAtPos(_position: Position): ISymbol | undefined {
        return undefined;
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

    public typeRef = new UCObjectTypeSymbol(this.id);

    getMemberSymbol() {
        return this.typeRef?.getRef();
    }

    getType() {
        return StaticNameType;
    }

    getContainedSymbolAtPos(_position: Position) {
        return this.typeRef.getRef() && this.typeRef;
    }

    index(document: UCDocument, _context?: UCStructSymbol) {
        const nameType = new UCNameTypeSymbol(this.id);
        this.typeRef.setReference(nameType, document, true);
    }

    toString() {
        return `'${this.id.name.text}'`;
    }
}

export class UCBoolLiteral extends UCLiteral {
    value!: boolean;

    getType() {
        return StaticBoolType;
    }

    toString() {
        return String(this.value);
    }
}

export class UCFloatLiteral extends UCLiteral {
    value!: number;

    getType() {
        return StaticFloatType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCIntLiteral extends UCLiteral {
    value!: number;

    getType() {
        return StaticIntType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCByteLiteral extends UCLiteral {
    value!: number;

    getType() {
        return StaticByteType;
    }

    getValue(): number {
        return this.value;
    }
}

export class UCObjectLiteral extends UCExpression {
    public castRef!: ITypeSymbol;
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
        this.castRef.index(document, context);

        if (this.objectRef) {
            if (UCQualifiedTypeSymbol.is(this.objectRef)) {
                for (let next: UCQualifiedTypeSymbol | undefined = this.objectRef; next; next = next.left) {
                    let symbol: ISymbol | undefined;
                    if (next.left) {
                        const hash = getSymbolOuterHash(getSymbolHash(next), getSymbolHash(next.left));
                        symbol = OuterObjectsTable.getSymbol(hash, this.castRef.getTypeFlags());
                    } else {
                        const hash = getSymbolHash(next);
                        symbol = ObjectsTable.getSymbol<UCPackage>(hash, UCTypeFlags.Package);
                    }
                    if (symbol) {
                        next.type.setReference(symbol, document);
                    }
                }
            } else {
                const id = this.objectRef.getName();
                const symbol = ObjectsTable.getSymbol(id, this.castRef.getTypeFlags())
                        ?? findOrIndexClassSymbol(id)
                        // FIXME: Hacky case for literals like Property'TempColor', only enums and structs are added to the objects table.
                        ?? context.findSuperSymbol(id);
                if (symbol) {
                    this.objectRef.setReference(symbol, document);
                }
            }
            this.objectRef.index(document, context);
        }
    }
}

// Struct literals are limited to Vector, Rotator, and Range.
export abstract class UCStructLiteral extends UCExpression {
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

    index(document: UCDocument, _context?: UCStructSymbol) {
        if (this.structType.getRef()) {
            return;
        }

        const symbol = ObjectsTable.getSymbol<UCStructSymbol>(this.structType.getName(), UCTypeFlags.Struct, CORE_PACKAGE);
        if (symbol) {
            this.structType.setReference(symbol, document, true);
        }
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
        return IntrinsicVectLiteral as unknown as UCSymbolReference;
    }
}

export class UCRotLiteral extends UCStructLiteral {
    structType = StaticRotatorType;

    getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRotLiteral as unknown as UCSymbolReference;
    }
}

export class UCRngLiteral extends UCStructLiteral {
    structType = StaticRangeType;

    getContainedSymbolAtPos(_position: Position) {
        return IntrinsicRngLiteral as unknown as UCSymbolReference;
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