import { DiagnosticSeverity, Range } from 'vscode-languageserver';

import {
    ArrayIterator,
    Array_LengthProperty,
    ClassModifierFlags,
    ContextInfo,
    ITypeSymbol,
    IntrinsicClass,
    IntrinsicClassConstructor,
    IntrinsicEnum,
    IntrinsicNewOperator,
    MethodFlags,
    StaticBoolType,
    StaticDelegateType,
    StaticIntType,
    StaticMetaType,
    StaticNameType,
    TypeMatchFlags,
    TypeMatchReport,
    UCArchetypeSymbol,
    UCArrayTypeSymbol,
    UCClassSymbol,
    UCConstSymbol,
    UCConversionCost,
    UCDelegateSymbol,
    UCDelegateTypeSymbol,
    UCEnumMemberSymbol,
    UCEnumSymbol,
    UCInterfaceSymbol,
    UCMethodSymbol,
    UCObjectTypeSymbol,
    UCParamSymbol,
    UCPropertySymbol,
    UCQualifiedTypeSymbol,
    UCScriptStructSymbol,
    UCStateSymbol,
    UCStructSymbol,
    UCSymbolKind,
    UCTypeKind,
    areDescendants,
    areIdentityMatch,
    areMethodsCompatible,
    getBinaryOperatorConversionCost,
    getConversionCost,
    getOperatorsByName,
    isArrayTypeSymbol,
    isClass,
    isDelegateSymbol,
    isEnumSymbol,
    isEnumTagSymbol,
    isField,
    isFixedArrayTypeSymbol,
    isFunction,
    isMethodSymbol,
    isStateSymbol,
    isStruct,
    resolveType,
    typesMatch,
    type ISymbol,
} from '../Symbols';
import { ModifierFlags } from '../Symbols/ModifierFlags';
import { UCDocument } from '../document';
import {
    IExpression,
    UCArrayCountExpression,
    UCAssignmentOperatorExpression,
    UCBaseOperatorExpression,
    UCBinaryOperatorExpression,
    UCCallExpression,
    UCConditionalExpression,
    UCDefaultAssignmentExpression,
    UCDefaultMemberCallExpression,
    UCDefaultStructLiteral,
    UCElementAccessExpression,
    UCEmptyArgument,
    UCIdentifierLiteralExpression,
    UCMemberExpression,
    UCMetaClassExpression,
    UCNameOfExpression,
    UCNewExpression,
    UCObjectAttributeExpression,
    UCObjectLiteral,
    UCParenthesizedExpression,
    UCPropertyAccessExpression,
    UCSizeOfLiteral,
    UCSuperExpression,
} from '../expressions';
import { config, getDocumentById } from '../indexer';
import { toName, type Name } from '../name';
import { NAME_ENUMCOUNT, NAME_EQUALEQUAL, NAME_NONE, NAME_NOTEQUAL, NAME_STATE, NAME_STRUCT } from '../names';
import { UCGeneration } from '../settings';
import {
    IStatement,
    UCArchetypeBlockStatement,
    UCAssertStatement,
    UCBlock,
    UCCaseClause,
    UCDefaultClause,
    UCDoUntilStatement,
    UCExpressionStatement,
    UCForEachStatement,
    UCForStatement,
    UCGotoStatement,
    UCIfStatement,
    UCRepIfStatement,
    UCReturnStatement,
    UCSwitchStatement,
    UCWhileStatement,
} from '../statements';
import { DefaultSymbolWalker } from '../symbolWalker';
import { DiagnosticCollection, createExpectedTypeMessage, createTypeCannotBeAssignedToMessage, symbolKindToDisplayString, typeToDisplayString } from './diagnostic';
import * as diagnosticMessages from './diagnosticMessages.json';

const OBJECT_DOCUMENT_ID = toName('Object');

// TODO: Check if a UField is obscuring another UField
export class DocumentAnalyzer extends DefaultSymbolWalker<void> {
    private readonly diagnostics = new DiagnosticCollection();
    private readonly scopes: UCStructSymbol[] = [];
    private context?: UCStructSymbol;
    private state: ContextInfo = {};
    private cachedState: ContextInfo = {};
    private allowedKindsMask: UCSymbolKind = 1 << UCClassSymbol.allowedKindsMask
        | 1 << UCSymbolKind.Class
        | 1 << UCSymbolKind.Interface;

    constructor(private document: UCDocument) {
        super();

        if (document.class && !getDocumentById(OBJECT_DOCUMENT_ID)) {
            this.diagnostics.add({
                range: document.class.range,
                message: {
                    text: "Missing '/Core/Classes/Object.uc' directory. Please include the missing UnrealScript SDK classes in your workspace!",
                    severity: DiagnosticSeverity.Warning
                }
            });
        }
    }

    public getDiagnostics() {
        return this.diagnostics;
    }

    private error(range: Range, text: string): void {
        this.diagnostics.add({
            range,
            message: {
                text,
                severity: DiagnosticSeverity.Error
            }
        });
    }

    private pushScope(context?: UCStructSymbol) {
        this.context = context;
        if (context) {
            this.scopes.push(context);
        }
    }

    private popScope(): UCStructSymbol | undefined {
        this.scopes.pop();
        this.context = this.scopes[this.scopes.length - 1];
        return this.context;
    }

    private resetState() {
        this.state = {};
    }

    private suspendState() {
        this.cachedState = this.state;
        this.state = {};
    }

    private resumeState() {
        this.state = this.cachedState;
    }

    private isAllowed(kind: UCSymbolKind): boolean {
        return (this.allowedKindsMask & 1 << kind) !== 0;
    }

    private setAllowed(kindFlags: UCSymbolKind): void {
        this.allowedKindsMask |= kindFlags;
    }

    private revokeAllowed(kind: UCSymbolKind): void {
        this.allowedKindsMask &= ~(1 << kind);
    }

    private nests: IStatement[] = [];

    private pushNest(next: IStatement) {
        this.nests.push(next);
    }

    private popNest() {
        this.nests.pop();
    }

    private nest<T extends IStatement>(): IStatement {
        const nest = <T>this.nests[this.nests.length - 1];
        return nest;
    }

    override visitQualifiedType(symbol: UCQualifiedTypeSymbol) {
        symbol.left?.accept(this);
        if (symbol.left && !symbol.left.getRef()) {
            return;
        }
        symbol.type.accept(this);
    }

    override visitObjectType(symbol: UCObjectTypeSymbol) {
        super.visitObjectType(symbol);

        const referredSymbol = symbol.getRef();
        if (!referredSymbol) {
            if (symbol.getExpectedKind() === UCSymbolKind.None) {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: diagnosticMessages.TYPE_0_NOT_FOUND,
                    args: [symbol.getName().text]
                });
            } else {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: diagnosticMessages.SYMBOL_KIND_0_1_NOT_FOUND,
                    args: [symbolKindToDisplayString(symbol.getExpectedKind()), symbol.getName().text]
                });
            }
        }
    }

    override visitArrayType(symbol: UCArrayTypeSymbol) {
        super.visitArrayType(symbol);
        // TODO: Check for valid array types
    }

    override visitDelegateType(symbol: UCDelegateTypeSymbol) {
        super.visitDelegateType(symbol);
    }

    override visitInterface(symbol: UCInterfaceSymbol) {
        if (!this.isAllowed(UCSymbolKind.Interface)) {
            this.diagnostics.add({
                range: symbol.range,
                message: diagnosticMessages._0_CANNOT_BE_DECLARED_HERE,
                args: ['An Interface']
            });
        }
        this.setAllowed(UCInterfaceSymbol.allowedKindsMask);
        this.pushScope(symbol);
        super.visitClass(symbol);
        const className = symbol.getName();
        if (className !== this.document.name) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: diagnosticMessages.CLASS_NAME_0_MUST_MATCH_DOCUMENT_NAME_1,
                args: [className.text, this.document.name.text]
            });
        }
    }

    override visitClass(symbol: UCClassSymbol) {
        if (!this.isAllowed(UCSymbolKind.Class)) {
            this.diagnostics.add({
                range: symbol.range,
                message: diagnosticMessages._0_CANNOT_BE_DECLARED_HERE,
                args: ['A Class']
            });
        }
        this.setAllowed(UCClassSymbol.allowedKindsMask);
        this.pushScope(symbol);
        super.visitClass(symbol);
        const className = symbol.getName();
        if (className !== this.document.name) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: diagnosticMessages.CLASS_NAME_0_MUST_MATCH_DOCUMENT_NAME_1,
                args: [className.text, this.document.name.text]
            });
        }

        // TODO: Maybe check for recursive issues?
        // if (symbol.dependsOnTypes) for (const type of symbol.dependsOnTypes) {
        //     const ref = type.getRef();
        //     if (ref) {

        //     }
        // }

        if (symbol.implementsTypes) {
            if (config.generation === UCGeneration.UC3) {
                if (config.checkTypes) for (const type of symbol.implementsTypes) {
                    const ref = type.getRef<UCClassSymbol>();
                    if (ref && (ref.classModifiers & ClassModifierFlags.Interface) === 0) {
                        this.diagnostics.add({
                            range: type.id.range,
                            message: diagnosticMessages.CLASS_0_IS_NOT_AN_INTERFACE,
                            args: [ref.getPath()]
                        });
                    }
                }
            } else {
                this.diagnostics.add({
                    range: symbol.range,
                    message: diagnosticMessages.IMPLEMENTS_IS_INCOMPATIBLE,
                });
            }
        }
    }

    override visitConst(symbol: UCConstSymbol) {
        this.pushScope(this.document.class);
        super.visitConst(symbol);
        if (symbol.expression) {
            // TODO: Check if expression is static
        } else {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Const declarations must be initialized!`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
        this.popScope();
    }

    override visitEnum(symbol: UCEnumSymbol) {
        if (!this.isAllowed(UCSymbolKind.Enum)) {
            this.diagnostics.add({
                range: symbol.range,
                message: {
                    text: `Struct must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        if (typeof symbol.children === 'undefined') {
            this.diagnostics.add({
                range: symbol.range,
                message: {
                    text: `Enumeration must contain at least one enumerator.`,
                    severity: DiagnosticSeverity.Error
                }
            });
            return;
        }

        this.pushScope(symbol);
        super.visitEnum(symbol);
        this.popScope();
    }

    override visitEnumMember(symbol: UCEnumMemberSymbol) {
        const enumSymbol = this.context as UCEnumSymbol;
        // The compiler interprets NAME_None as not found, and NAME_ENUMCOUNT is always preceded.
        if (symbol.id.name === NAME_ENUMCOUNT || symbol.id.name === NAME_NONE) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Enumeration tag '${symbol.getName().text}' is obscured by keyword ${symbol.getName().text}.`,
                    severity: DiagnosticSeverity.Error
                }
            });
            return;
        }

        const duplicateEnumerator = enumSymbol.findSymbolPredicate(s => s.id.name === symbol.id.name && s !== symbol);
        if (typeof duplicateEnumerator !== 'undefined') {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Duplicate enumeration tag '${symbol.getName().text}'`,
                    severity: DiagnosticSeverity.Error
                }
            });
        } else if (symbol.value > 255) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Exceeded maximum of 255 enumerators.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
    }

    override visitScriptStruct(symbol: UCScriptStructSymbol) {
        if (!this.isAllowed(UCSymbolKind.ScriptStruct)) {
            this.diagnostics.add({
                range: symbol.range,
                message: {
                    text: `Struct must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        this.pushScope(symbol);

        const lastAllowedKindsMask = this.allowedKindsMask;
        this.setAllowed(UCScriptStructSymbol.allowedKindsMask);
        super.visitScriptStruct(symbol);
        this.setAllowed(lastAllowedKindsMask);

        if (config.checkTypes && symbol.extendsType) {
            const referredSymbol = symbol.extendsType.getRef();
            if (referredSymbol && referredSymbol.getTypeKind() !== UCTypeKind.Struct) {
                this.diagnostics.add({
                    range: symbol.extendsType.id.range,
                    message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
                    args: [NAME_STRUCT.text, referredSymbol.getPath()]
                });
            }
        }
        this.popScope();
    }

    override visitProperty(symbol: UCPropertySymbol) {
        if (!this.isAllowed(UCSymbolKind.Property)) {
            this.diagnostics.add({
                range: symbol.range,
                message: {
                    text: `Property must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
        super.visitProperty(symbol);

        // Not an user-defined dimension.
        if (!symbol.arrayDimRange) {
            return;
        }

        if (isFixedArrayTypeSymbol(symbol.type)) {
            const arraySize = symbol.getArrayDimSize();
            if (!arraySize) {
                const dimSymbolRef = symbol.arrayDimRef?.getRef();
                if (dimSymbolRef && config.generation !== UCGeneration.UC3) {
                    if (isEnumSymbol(dimSymbolRef) || isEnumTagSymbol(dimSymbolRef)) {
                        this.diagnostics.add({
                            range: symbol.arrayDimRange,
                            message: {
                                text: `Using an enum or enum tag as an array dimension, is only available as of UC3.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                        return;
                    }
                }

                this.diagnostics.add({
                    range: symbol.arrayDimRange,
                    message: {
                        text: `Bad array size, try refer to a type that can be evaluated to an array dimension!`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            } else if (arraySize > 2048 || arraySize <= 1) {
                this.diagnostics.add({
                    range: symbol.arrayDimRange,
                    message: {
                        text: `Illegal array size, must be between 2-2048.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        }

        if (config.checkTypes) {
            const baseType
                = isArrayTypeSymbol(symbol.type) ? symbol.type.baseType
                    : isFixedArrayTypeSymbol(symbol.type) ? symbol.type
                        : undefined;

            if (baseType) {
                const arrayType = baseType.getTypeKind();
                if (arrayType === UCTypeKind.Array) {
                    this.diagnostics.add({
                        range: symbol.arrayDimRange,
                        message: {
                            text: `Illegal array type ${typeToDisplayString(baseType)}.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                } else if (arrayType === UCTypeKind.Bool && config.generation !== UCGeneration.UC3) {
                    this.diagnostics.add({
                        range: symbol.arrayDimRange,
                        message: {
                            text: `Illegal array type ${typeToDisplayString(baseType)}, is only available as of UC3.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            }

            // TODO: Should define a custom type class for arrays, so that we can analyze it right there.
        }
    }

    override visitMethod(symbol: UCMethodSymbol) {
        this.pushScope(symbol);
        this.suspendState();
        this.setAllowed(UCMethodSymbol.allowedKindsMask);

        if (symbol.params) {
            let requiredParamsCount = 0;
            for (; requiredParamsCount < symbol.params.length; ++requiredParamsCount) {
                if (symbol.params[requiredParamsCount].hasAnyModifierFlags(ModifierFlags.Optional)) {
                    // All trailing params after the first optional param, are required to be declared as 'optional' too.
                    for (let i = requiredParamsCount + 1; i < symbol.params.length; ++i) {
                        const param = symbol.params[i];
                        if (param.hasAnyModifierFlags(ModifierFlags.Optional)) {
                            continue;
                        }

                        this.diagnostics.add({
                            range: param.id.range,
                            message: {
                                text: `Parameter '${param.getName().text}' must be marked 'optional' after an optional parameter.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                    }
                    break;
                }
            }
            symbol.requiredParamsCount = requiredParamsCount;
        }

        super.visitMethod(symbol);
        this.revokeAllowed(UCSymbolKind.Property);
        this.resumeState();

        if (symbol.isOperatorKind()) {
            if (!symbol.hasAnySpecifierFlags(MethodFlags.Final)) {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: {
                        text: `Operator must be declared as 'final'`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }

            if (symbol.isBinaryOperator()) {
                if (!symbol.params || symbol.params.length !== 2) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `An operator is required to have a total of 2 parameters.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }

                if (!symbol.precedence) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `Operator must have a precedence.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                } else if (symbol.precedence < 0 || symbol.precedence > 255) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `Operator precedence must be between 0-255.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            }
        }

        if (symbol.overriddenMethod) {
            // TODO: check difference
        }
        this.popScope();
    }

    override visitState(symbol: UCStateSymbol) {
        this.pushScope(symbol);
        this.suspendState();
        this.setAllowed(UCStateSymbol.allowedKindsMask);
        super.visitState(symbol);
        this.revokeAllowed(UCSymbolKind.Property);
        this.resumeState();

        if (symbol.extendsType) {
            if (symbol.overriddenState) {
                this.diagnostics.add({
                    range: symbol.extendsType.id.range,
                    message: { text: `'Extends' is not allowed here: The state already overrides state '{0}'` },
                    args: [symbol.overriddenState.getPath()]
                });
            } else {
                const referredSymbol = symbol.extendsType.getRef();
                if (referredSymbol && !isStateSymbol(referredSymbol)) {
                    this.diagnostics.add({
                        range: symbol.extendsType.id.range,
                        message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
                        args: [NAME_STATE.text, referredSymbol.getPath()]
                    });
                }
            }
        }

        if (symbol.ignoreRefs) for (const ref of symbol.ignoreRefs) {
            // TODO: How does uscript behave when an operator is referred?
            const referredSymbol = ref.getRef();
            if (!referredSymbol) {
                this.diagnostics.add({
                    range: ref.id.range,
                    message: diagnosticMessages.COULDNT_FIND_0,
                    args: [ref.getName().text]
                });
            } else if (isFunction(referredSymbol)) {
                if (referredSymbol.hasAnySpecifierFlags(MethodFlags.Final)) {
                    this.diagnostics.add({
                        range: ref.id.range,
                        message: {
                            text: `Cannot ignore final functions.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            } else {
                this.diagnostics.add({
                    range: ref.id.range,
                    message: {
                        text: `'${referredSymbol.getName().text}' is not a function.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        }
        this.popScope();
    }

    override visitParameter(symbol: UCParamSymbol) {
        super.visitParameter(symbol);

        if (symbol.defaultExpression) {
            if (config.generation === UCGeneration.UC3) {
                if (!symbol.hasAnyModifierFlags(ModifierFlags.Optional)) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `To assign a default value to a parameter, it must be marked as 'Optional'`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            } else {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: {
                        text: `Assigning a default value to a parameter, is only available as of UC3.`,
                        severity: DiagnosticSeverity.Error
                    },
                });
            }
        }

        if (config.generation !== UCGeneration.UC3) {
            if (symbol.hasAnyModifierFlags(ModifierFlags.Ref)) {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: {
                        text: `'Ref' is not allowed, is only available in some versions of UC3 (such as XCom2)`,
                        severity: DiagnosticSeverity.Error
                    },
                });
            }
        }
    }

    override visitRepIfStatement(stm: UCRepIfStatement) {
        super.visitRepIfStatement(stm);
        const refs = stm.symbolRefs;
        if (typeof refs === 'undefined') {
            this.diagnostics.add({
                range: stm.range,
                message: {
                    text: `Missing members!`,
                    severity: DiagnosticSeverity.Error
                }
            });
            return;
        }

        for (const ref of refs) {
            const symbol = ref.getRef();
            if (typeof symbol === 'undefined') {
                this.diagnostics.add({
                    range: ref.id.range,
                    message: {
                        text: `Variable '${ref.getName().text}' not found!`,
                        severity: DiagnosticSeverity.Error
                    }
                });
                continue;
            }

            const symbolKind = symbol.kind;
            if (symbolKind !== UCSymbolKind.Property
                && symbolKind !== UCSymbolKind.Function
                && symbolKind !== UCSymbolKind.Event) {
                this.diagnostics.add({
                    range: ref.id.range,
                    message: {
                        text: `Type of '${symbol.getName().text}' is neither a variable nor function!`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            } else {
                // i.e. not defined in the same class as where the replication statement resides in.
                if (symbol.outer !== this.document.class) {
                    this.diagnostics.add({
                        range: ref.id.range,
                        message: {
                            text: `Variable or Function '${symbol.getPath()}' needs to be declared in Class '${this.document.class!.getPath()}'!`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            }
        }
    }

    override visitArchetypeBlockStatement(stm: UCArchetypeBlockStatement): void {
        stm.archetypeSymbol.accept(this);

        this.pushScope(stm.archetypeSymbol);
        if (stm.block) {
            stm.block.accept(this);
        }
        this.popScope();
    }

    override visitArchetypeSymbol(symbol: UCArchetypeSymbol) {
        if (config.generation === UCGeneration.UC1) {
            this.diagnostics.add({
                range: symbol.range,
                message: {
                    text: `Object declarations are not available in UC1.`,
                    severity: DiagnosticSeverity.Error
                }
            });

            return;
        }

        if (symbol.getName() === NAME_NONE) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Object declaration is missing a name.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        } else if (!symbol.extendsType) { // No class attribute or bad name?
            if (config.generation === UCGeneration.UC3) {
                if (!symbol.overriddenArchetype) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `Couldn't find object to override of name '${symbol.getName().text}' or maybe you forgot to assign a Class?`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            } else {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: {
                        text: `Object declaration is missing a Class.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        }
    }

    override visitBlock(symbol: UCBlock) {
        for (const statement of symbol.statements) if (statement) {
            try {
                statement.accept?.(this);
            } catch (err) {
                const range = statement.range;
                console.error('Error during analysis at', this.context ? this.context.getPath() : '???', range, err);
            }
        }
    }

    private verifyStatementExpression(stm: UCExpressionStatement) {
        if (!stm.expression) {
            this.diagnostics.add({
                range: stm.range,
                message: diagnosticMessages.EXPECTED_EXPRESSION
            });
        }
    }

    private verifyStatementBooleanCondition(stm: UCExpressionStatement) {
        if (!config.checkTypes)
            return;

        if (stm.expression) {
            const type = stm.expression.getType();
            if (type && typesMatch(type, StaticBoolType, TypeMatchFlags.None) <= 0) {
                this.diagnostics.add({
                    range: stm.expression.range,
                    message: createExpectedTypeMessage(StaticBoolType, type)
                });
            }
        }
    }

    override visitIfStatement(stm: UCIfStatement) {
        this.pushNest(stm);
        super.visitIfStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
        this.popNest();
    }

    override visitWhileStatement(stm: UCWhileStatement) {
        this.pushNest(stm);
        super.visitWhileStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
        this.popNest();
    }

    override visitSwitchStatement(stm: UCSwitchStatement) {
        this.pushNest(stm);
        super.visitSwitchStatement(stm);
        this.verifyStatementExpression(stm);
        this.popNest();
    }

    override visitCaseClause(stm: UCCaseClause) {
        this.pushNest(stm);
        super.visitCaseClause(stm);
        this.verifyStatementExpression(stm);
        this.popNest();
    }

    override visitDefaultClause(stm: UCDefaultClause) {
        this.pushNest(stm);
        super.visitDefaultClause(stm);
        this.popNest();
    }

    override visitDoUntilStatement(stm: UCDoUntilStatement) {
        this.pushNest(stm);
        super.visitDoUntilStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
        this.popNest();
    }

    // TODO: Test if any of the three expression can be omitted?
    override visitForStatement(stm: UCForStatement) {
        this.pushNest(stm);
        super.visitForStatement(stm);
        this.popNest();

        if (stm.init) {
            // TODO: Check if the operator has an "out" parameter?
            const hasAffect = true;
            if (!hasAffect) {
                this.diagnostics.add({
                    range: stm.init.range,
                    message: {
                        text: `Expression has no effect.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        } else {
            this.diagnostics.add({
                range: stm.range,
                message: {
                    text: `Missing initialization expression.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        if (stm.expression) {
            this.verifyStatementBooleanCondition(stm);
        } else {
            this.diagnostics.add({
                range: stm.range,
                message: {
                    text: `Missing conditional expression.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        if (stm.next) {
            // TODO: Check if the operator has an "out" parameter? And how about functions?
            const hasAffect = true;
            if (!hasAffect) {
                this.diagnostics.add({
                    range: stm.next.range,
                    message: {
                        text: `Expression has no effect.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        } else {
            this.diagnostics.add({
                range: stm.range,
                message: {
                    text: `Missing next expression.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
    }

    override visitForEachStatement(stm: UCForEachStatement) {
        this.pushNest(stm);
        // handled below, necessary so we can skip the analysis if we are iterating on a dynamic array.
        // super.visitForEachStatement(stm);
        this.verifyStatementExpression(stm);
        this.popNest();

        if (!stm.expression) {
            return;
        }

        if (!(stm.expression instanceof UCCallExpression)) {
            this.diagnostics.add({
                range: stm.expression.range,
                message: {
                    text: `Expression does not evaluate to an iterable, did you forget to specify arguments?`,
                    severity: DiagnosticSeverity.Error
                }
            });

            return;
        } else if (!stm.expression.arguments) {
            this.diagnostics.add({
                range: stm.expression.range,
                message: {
                    text: `Missing iterator arguments.`,
                    severity: DiagnosticSeverity.Error
                }
            });

            return;
        }

        const symbol = stm.expression.getMemberSymbol();
        if (symbol && isField(symbol)) {
            // Cannot iterate on the return result of a function expression.
            if (isFunction(symbol)) {
                if ((symbol.specifiers & MethodFlags.Iterator) == 0) {
                    this.diagnostics.add({
                        range: stm.expression.range,
                        message: {
                            text: `Function is not an iterator.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }

                // Diagnose the arguments for additional errors
                stm.expression.accept(this);
                return;
            }

            if (config.checkTypes && stm.expression.getType()) {
                const type = stm.expression.getType()!;

                if (config.generation != UCGeneration.UC3) {
                    this.diagnostics.add({
                        range: stm.expression.range,
                        message: {
                            text: `Type ${typeToDisplayString(type)}' cannot be iterated. Expected an iterator function.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });

                    // Diagnose the arguments for additional errors
                    stm.expression.accept(this);
                    return;
                }

                if (type.getTypeKind() === UCTypeKind.Array) {
                    // check the arguments against our intrinsic ArrayIterator.
                    const arrayInnerType = (symbol.getType() as UCArrayTypeSymbol).baseType;
                    this.checkArguments(ArrayIterator, stm.expression, stm.expression.arguments, arrayInnerType);

                    // Skip analysis below
                    return;
                } else if (type.getTypeKind() !== UCTypeKind.Error) {
                    this.diagnostics.add({
                        range: stm.expression.range,
                        message: {
                            text: `Type ${typeToDisplayString(type)} cannot be iterated. Expected an iterator function or dynamic array.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }

                // Diagnose the arguments for additional errors
                stm.expression.accept(this);
            }
        }
    }

    override visitGotoStatement(stm: UCGotoStatement) {
        this.verifyStatementExpression(stm);

        if (!config.checkTypes)
            return;

        if (stm.expression) {
            const type = stm.expression.getType();
            if (type && typesMatch(type, StaticNameType, TypeMatchFlags.None) <= 0) {
                this.diagnostics.add({
                    range: stm.expression.range,
                    message: createExpectedTypeMessage(StaticNameType, type)
                });
            }
        }
    }

    override visitReturnStatement(stm: UCReturnStatement) {
        super.visitReturnStatement(stm);

        if (!config.checkTypes)
            return;

        if (this.context && isFunction(this.context)) {
            const functionReturnType = this.context.getType();
            if (stm.expression) {
                const returnType = stm.expression.getType();
                if (!functionReturnType) {
                    // TODO: No return expression expected!
                } else if (returnType) {
                    const report = typesMatch(
                        returnType,
                        functionReturnType,
                        // Compiler behavior, suppress 'Out' rules for return types in a return expression.
                        TypeMatchFlags.Generalize | TypeMatchFlags.SuppressOut
                    );
                    if (report <= 0) {
                        this.diagnostics.add({
                            range: stm.range,
                            message: {
                                text: `Type {0} is not assignable to return type {1}.`,
                                severity: DiagnosticSeverity.Error
                            },
                            args: [
                                typeToDisplayString(returnType),
                                typeToDisplayString(functionReturnType)
                            ]
                        });
                    }
                }
            } else if (functionReturnType) {
                // TODO: Expect a return expression!
                this.verifyStatementExpression(stm);
            }
        } else {
            // TODO: Return not allowed here?
        }
    }

    override visitAssertStatement(stm: UCAssertStatement) {
        super.visitAssertStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
    }

    override visitExpression(expr: IExpression) {
        if (expr instanceof UCParenthesizedExpression) {
            expr.expression?.accept(this);
        } else if (expr instanceof UCMetaClassExpression) {
            expr.classRef?.accept(this);
            expr.expression?.accept(this);
            // TODO: verify class type by inheritance
        } else if (expr instanceof UCCallExpression) {
            expr.expression.accept(this);
            expr.arguments?.forEach(arg => arg.accept(this));

            const destType = expr.expression.getType();
            // Let's be silent when working with an unresolved type.
            if (!destType) {
                return;
            }

            const symbol = destType.getRef();
            if (symbol && isFunction(symbol)) {
                // FIXME: inferred type, this is unfortunately complicated :(
                this.checkArguments(symbol, expr, expr.arguments);
                return;
            }

            // ! We are validating a conversion
            if (!config.checkTypes)
                return;

            const firstArgument = expr.arguments?.length === 1
                ? expr.arguments[0]
                : undefined;
            const inputArgumentType = firstArgument?.getType();
            if (!inputArgumentType) {
                return;
            }

            const inputArgumentTypeKind = inputArgumentType.getTypeKind();
            const destTypeKind = destType.getTypeKind();

            // also struct, but we don't have to verify inheritance, because that is not even allowed in UnrealScript.
            const classTypesToCheck = 1 << UCTypeKind.Object | 1 << UCTypeKind.Interface;
            // If both are identical with one of the super-types
            if ((1 << inputArgumentTypeKind & classTypesToCheck) &
                (1 << destTypeKind & classTypesToCheck)) {
                const destSymbol = destType.getRef<UCStructSymbol>();
                const inputSymbol = inputArgumentType.getRef<UCStructSymbol>();
                // No point in analyzing unresolved types.
                if (!isStruct(destSymbol) || !isStruct(inputSymbol)) {
                    return;
                }

                // TODO: Handle Object to Interface too

                // Reverse input with dest if we are attempting to cast a class.
                // Suppress 'Out' which may have been set for the return type of a function.
                const report = typesMatch(
                    destType, inputArgumentType,
                    TypeMatchFlags.Generalize |
                    TypeMatchFlags.SuppressOut
                );
                if (report > 0) {
                    // Identical cast?
                    if (areIdentityMatch(destSymbol, inputSymbol)) {
                        this.error(
                            expr.range,
                            `Redundant cast to type ${typeToDisplayString(destType)}.`
                        );

                        return;
                    }
                    // TODO: Also validate unnecessary casts based on context like the parameter being passed to.
                    // -- Like for instance, casting Pawn to xPawn<Pawn when a function's parameter only requires Pawn.
                } else if (
                    report === TypeMatchReport.ClassMismatch ||
                    report === TypeMatchReport.MetaClassMismatch) {
                    if (areDescendants(destSymbol, inputSymbol)) {
                        this.error(
                            expr.range,
                            `Redundant cast to parent type ${typeToDisplayString(destType)}.`
                        );

                        return;
                    }

                    this.error(
                        expr.range,
                        `Cannot cast to type ${typeToDisplayString(destType)} because it does not derive from type ${typeToDisplayString(inputArgumentType)}.`
                    );

                    return;
                } else if (report === TypeMatchReport.ClassAndInterfaceMismatch) {
                    // TODO: clear interface diagnostics
                }
            } else {
                const report = typesMatch(inputArgumentType, destType, TypeMatchFlags.Coerce);
                if (report > 0) {
                    const typesToCheck = 1 << UCTypeKind.Byte
                        | 1 << UCTypeKind.Int
                        | 1 << UCTypeKind.Bool
                        | 1 << UCTypeKind.Float
                        | 1 << UCTypeKind.Name
                        | 1 << UCTypeKind.String
                        | 1 << UCTypeKind.Button
                        | 1 << UCTypeKind.Struct;

                    if ((1 << inputArgumentTypeKind & typesToCheck) !== 0
                        && getConversionCost(inputArgumentType, destType) === UCConversionCost.Zero) {
                        this.error(expr.range,
                            `Type ${typeToDisplayString(inputArgumentType)} should not be cast to itself.`);
                    }

                    // ...success
                } else {
                    this.error(expr.range,
                        `Type ${typeToDisplayString(inputArgumentType)} cannot be cast to type ${typeToDisplayString(destType)}.`);
                }
            }

            const nest = this.nest();
            if (nest instanceof UCSwitchStatement && nest.expression) {
                const invalidCastTypes = 1 << UCTypeKind.Object
                    | 1 << UCTypeKind.Interface
                    | 1 << UCTypeKind.String
                    | 1 << UCTypeKind.Delegate
                    | 1 << UCTypeKind.Struct;

                if ((1 << destTypeKind & invalidCastTypes)) {
                    this.error(expr.range,
                        `Cannot switch on a dynamic cast of type ${typeToDisplayString(destType)}.`);
                }
            }
        } else if (expr instanceof UCElementAccessExpression) {
            if (expr.expression) {
                expr.expression.accept(this);
                if (config.checkTypes) {
                    const type = expr.getType();
                    if (type?.getTypeKind() === UCTypeKind.None && expr.getMemberSymbol()) {
                        this.diagnostics.add({
                            range: expr.range,
                            message: {
                                text: `Type of '${expr.getMemberSymbol()!.getPath()}' is not a valid array.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                    }
                }
            }

            if (expr.argument) {
                expr.argument.accept(this);
                if (config.checkTypes) {
                    const type = expr.argument.getType();
                    if (type) {
                        if (typesMatch(type, StaticIntType, TypeMatchFlags.Generalize) <= 0) {
                            this.diagnostics.add({
                                range: expr.argument.range,
                                message: {
                                    text: `Element access expression type ${typeToDisplayString(type)} is invalid.`,
                                    severity: DiagnosticSeverity.Error
                                }
                            });
                        }
                    }
                }
            } else {
                this.diagnostics.add({
                    range: expr.range,
                    message: {
                        text: `An element access expression should take an argument.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        } else if (expr instanceof UCPropertyAccessExpression) {
            this.suspendState();
            expr.left.accept(this);
            this.resumeState();

            const memberContext = expr.left.getType()?.getRef<UCStructSymbol>();
            this.pushScope(memberContext);
            expr.member?.accept(this);
            this.popScope();
        } else if (expr instanceof UCConditionalExpression) {
            expr.condition.accept(this);
            expr.true?.accept(this);
            expr.false?.accept(this);
        } else if (expr instanceof UCBaseOperatorExpression) {
            expr.expression.accept(this);
            // Not indexed?
            if (!expr.operator.getRef()) {
                const operandType = expr.expression.getType();
                const candidates = getOperatorsByName(this.document.class, expr.operator.getName());
                if (candidates.length === 0) {
                    this.pushError(expr.operator.range, `Couldn't find unary operator '${expr.operator.id.name.text}'`);
                } else if (config.checkTypes && operandType && operandType.getTypeKind() !== UCTypeKind.Error) {
                    // TODO: 'else' Suggest candidates?
                    // TODO: No overload error?
                    this.diagnostics.add({
                        range: expr.range,
                        message: {
                            // TODO: List all incompatible types
                            text: `Type {0} is incompatible with operator '{1}'.`,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [
                            typeToDisplayString(operandType),
                            expr.operator.id.name.text
                        ]
                    });
                }
            }
        } else if (expr instanceof UCBinaryOperatorExpression) {
            if (expr.left) {
                expr.left.accept(this);

                const type = expr.left.getType();
                this.state.contextType = type;
            } else {
                this.pushError(expr.range, "Missing left-hand side expression!");
                return;
            }
            if (expr.right) {
                expr.right.accept(this);
            } else {
                this.pushError(expr.range, "Missing right-hand side expression!");
                return;
            }

            // Defined but not indexed? (undefined for the '=' assignment)
            if (expr.operator && !expr.operator.getRef()) {
                const operatorName = expr.operator.id.name;
                const candidates = getOperatorsByName(this.document.class, operatorName);
                if (candidates.length === 0) {
                    this.pushError(expr.operator.range, `Couldn't find operator '${expr.operator.id.name.text}'`);
                } else if (config.checkTypes) {
                    const leftOperandType = expr.left.getType();
                    const rightOperandType = expr.right.getType();

                    if (leftOperandType && leftOperandType.getTypeKind() !== UCTypeKind.Error &&
                        rightOperandType && rightOperandType.getTypeKind() !== UCTypeKind.Error) {
                        function isComparisonOperatorName(name: Name): boolean {
                            return name === NAME_EQUALEQUAL || name === NAME_NOTEQUAL;
                        }

                        // Mute incompatible errors when comparing a struct using the intrinsic comparisons.
                        // TODO: Perhaps provide and index an intrinsic symbol for these cases.
                        if (leftOperandType.getTypeKind() === UCTypeKind.Struct &&
                            rightOperandType.getTypeKind() === UCTypeKind.Struct
                            && typeof leftOperandType.arrayDimension === 'undefined'
                            && typeof rightOperandType.arrayDimension === 'undefined'
                            && isComparisonOperatorName(operatorName)
                            // same struct type
                            && areIdentityMatch(leftOperandType.getRef()!, rightOperandType.getRef()!)
                        ) {
                            // do nothing, this is an intrinsic comparison of the same struct type.
                        } else if (
                            // comparisons were introduced with UE3.
                            config.generation === UCGeneration.UC3
                            && leftOperandType.getTypeKind() === UCTypeKind.Delegate
                            && rightOperandType.getTypeKind() === UCTypeKind.Delegate
                            && isComparisonOperatorName(operatorName)
                        ) {
                            // if (isFunction(resolveType(leftOperandType).getRef()) &&
                            //     isFunction(resolveType(rightOperandType).getRef())
                            //     && !areMethodsCompatible(
                            //         resolveType(leftOperandType).getRef()!,
                            //         resolveType(rightOperandType).getRef()!
                            //     )
                            // ) {
                            //     this.diagnostics.add({
                            //         range: expr.right.range,
                            //         message: diagnosticMessages.DELEGATE_IS_INCOMPATIBLE,
                            //         args: [
                            //             expr.left!.getMemberSymbol()!.getPath(),
                            //             expr.right!.getMemberSymbol()!.getPath(),
                            //         ]
                            //     });
                            // }
                            // do nothing, this is an intrinsic comparison of a delegate type.
                        } else {
                            let lowestCost = UCConversionCost.Illegal;
                            const compatibleCandidates = candidates
                                .filter(c => {
                                    if (!c.isBinaryOperator()) {
                                        return false;
                                    }

                                    const evalulatedCost: UCConversionCost = getBinaryOperatorConversionCost(c, leftOperandType, rightOperandType);
                                    if (evalulatedCost === UCConversionCost.Illegal) {
                                        return false;
                                    }

                                    if (evalulatedCost > lowestCost) {
                                        return false;
                                    }

                                    lowestCost = evalulatedCost;

                                    return true;
                                });

                            if (compatibleCandidates.length > 0) {
                                const candidatesText = compatibleCandidates
                                    .map(c => `'${c.buildParameters()}'`)
                                    .join(', ');

                                this.diagnostics.add({
                                    range: expr.range,
                                    message: {
                                        text: `Type {0} and type {1} are incompatible with operator '{2}' due overlapping overloads [${candidatesText}]`,
                                        severity: DiagnosticSeverity.Error
                                    },
                                    args: [
                                        typeToDisplayString(leftOperandType),
                                        typeToDisplayString(rightOperandType),
                                        operatorName.text
                                    ]
                                });
                            } else {
                                this.diagnostics.add({
                                    range: expr.range,
                                    message: {
                                        text: `Type {0} and type {1} are incompatible with operator '{2}'`,
                                        severity: DiagnosticSeverity.Error
                                    },
                                    args: [
                                        typeToDisplayString(leftOperandType),
                                        typeToDisplayString(rightOperandType),
                                        operatorName.text
                                    ]
                                });
                            }
                        }
                    }
                }
                // TODO: 'else' Suggest candidates?
            }

            if (!(expr instanceof UCAssignmentOperatorExpression || expr instanceof UCDefaultAssignmentExpression)) {
                return;
            }

            // Apply type checking below only for the intrinsic '=' (which has an undefined 'operator')
            if (expr.operator) {
                // TODO: Still must present non-compatible overloading diagnostics
                return;
            }

            const letType = expr.left.getType();
            if (typeof letType === 'undefined') {
                // We don't want to analyze a symbol with an unresolved type.
                return;
            }
            const valueType = expr.right.getType();
            if (typeof valueType === 'undefined') {
                return;
            }

            const letSymbol = expr.left.getMemberSymbol();
            if (!letSymbol) {
                this.pushError(
                    expr.left.range,
                    `Couldn't find variable '${letType.getName().text}'`
                );

                return;
            }

            if (!isField(letSymbol)) {
                this.pushError(
                    expr.left.range,
                    `The left-hand side of an assignment expression must be a variable.`
                );

                return;
            }

            let matchFlags: TypeMatchFlags = TypeMatchFlags.Generalize;
            if (expr instanceof UCDefaultAssignmentExpression) {
                matchFlags |= TypeMatchFlags.T3D;
            }

            if (isMethodSymbol(letSymbol)) {
                this.diagnostics.add({
                    range: expr.left.range,
                    message: {
                        text: `Cannot assign to '${letSymbol.getName().text}' because it is a function. Did you mean to assign a delegate?`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            } else if (
                // Both Native and Transient modifiers will skip serialization, except for transient since UE3? (needs to be tested thoroughly).
                ((letSymbol.modifiers & ModifierFlags.Native) !== 0
                    || ((letSymbol.modifiers & ModifierFlags.Transient) !== 0
                        && config.generation !== UCGeneration.UC3)
                ) && (matchFlags & TypeMatchFlags.T3D)
                // Ignore same-line assignments like Name= and Class=
                && !(expr instanceof UCObjectAttributeExpression)
            ) {
                const modifiers = letSymbol
                    .buildModifiers(letSymbol.modifiers & (ModifierFlags.Native | ModifierFlags.Transient))
                    .join(' ');
                this.diagnostics.add({
                    range: expr.left.range,
                    message: {
                        text: `(${modifiers}) '${letSymbol.getName().text}' will not be serialized.`,
                        severity: DiagnosticSeverity.Warning
                    }
                });
            }

            if (!config.checkTypes) {
                return;
            }

            // Assigning to a const property is allowed in a T3D context.
            if ((matchFlags & TypeMatchFlags.T3D) === 0) {
                if ((letType.flags & ModifierFlags.ReadOnly) !== 0) {
                    this.diagnostics.add({
                        range: expr.left.range,
                        message: {
                            text: `Cannot assign to type {0} because it is a constant.`,
                            severity: DiagnosticSeverity.Error,
                        },
                        args: [
                            typeToDisplayString(letType)
                        ]
                    });
                }
            }

            if (letType.getTypeKind() === UCTypeKind.Delegate) {
                // TODO: Cleanup duplicate code when binary-operator types are resolved properly.
                if (typesMatch(valueType, StaticDelegateType, TypeMatchFlags.None) > 0) {
                    const letTypeRef = resolveType(letType).getRef<UCDelegateSymbol>();
                    const valueTypeRef = resolveType(valueType).getRef<UCMethodSymbol>();
                    if (letTypeRef && isDelegateSymbol(letTypeRef) &&
                        valueTypeRef && isFunction(valueTypeRef)
                        && !areMethodsCompatible(letTypeRef, valueTypeRef)) {
                        this.diagnostics.add({
                            range: expr.right.range,
                            message: diagnosticMessages.DELEGATE_IS_INCOMPATIBLE,
                            args: [valueTypeRef.getPath(), letSymbol.getPath()]
                        });
                    }
                } else {
                    this.diagnostics.add({
                        range: expr.right.range,
                        message: createTypeCannotBeAssignedToMessage(StaticDelegateType, valueType),
                    });
                }
            } else {
                const report = typesMatch(valueType, letType, matchFlags | TypeMatchFlags.SuppressOut);
                if (report <= 0) {
                    // Produce a more specific warning for incompatible classes.
                    if (report === TypeMatchReport.ClassMismatch || report === TypeMatchReport.MetaClassMismatch) {
                        this.diagnostics.add({
                            range: expr.range,
                            message: {
                                text: `Cannot assign type {0} to type of field '{1}' because it does not derive from type {2}.`,
                                severity: DiagnosticSeverity.Error
                            },
                            args: [
                                typeToDisplayString(valueType),
                                letSymbol.getName().text,
                                typeToDisplayString(letType)
                            ]
                        });
                    } else {
                        this.diagnostics.add({
                            range: expr.right.range,
                            message: createTypeCannotBeAssignedToMessage(letType, valueType),
                        });
                    }
                }
            }
        } else if (expr instanceof UCDefaultMemberCallExpression) {
            expr.propertyMember.accept(this);

            const type = expr.propertyMember.getType();
            if (type) {
                if (!isArrayTypeSymbol(type)) {
                    this.pushError(expr.operationMember.range, `Array operations are only allowed on dynamic arrays.`);
                } else {
                    const operationType = expr.operationMember;
                    const operationSymbol = operationType.getRef();
                    if (operationSymbol && isFunction(operationSymbol)) {
                        this.checkArguments(operationSymbol, expr, expr.arguments, expr.getType());
                    } else {
                        this.pushError(operationType.range, `Unrecognized array operation '${operationType.id.name.text}'`);
                    }
                }
            }
            expr.arguments?.forEach(arg => arg.accept(this));
        } else if (expr instanceof UCIdentifierLiteralExpression) {
            if (!this.state.contextType) {
                return;
            }

            if (!expr.type) {
                if (this.context) {
                    this.diagnostics.add({
                        range: expr.range,
                        message: {
                            text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text, this.context.getPath()]
                    });
                } else {
                    this.diagnostics.add({
                        range: expr.range,
                        message: {
                            text: diagnosticMessages.COULDNT_FIND_0.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text]
                    });
                }
            }
        } else if (expr instanceof UCMemberExpression) {
            if (!expr.type) {
                if (this.context) {
                    this.diagnostics.add({
                        range: expr.range,
                        message: {
                            text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text, this.context.getPath()]
                    });
                } else {
                    this.diagnostics.add({
                        range: expr.range,
                        message: {
                            text: diagnosticMessages.COULDNT_FIND_0.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text]
                    });
                }

                return;
            }

            const memberSymbol = expr.getMemberSymbol();
            if (isField(memberSymbol) && memberSymbol.hasAnyModifierFlags(ModifierFlags.Deprecated)) {
                this.diagnostics.add({
                    range: expr.range,
                    message: {
                        text: `Reference to deprecated field '${memberSymbol.getName().text}'`,
                        severity: DiagnosticSeverity.Warning
                    }
                });
            }
        } else if (expr instanceof UCSuperExpression) {
            // TODO: verify class type by inheritance
            if (expr.structTypeRef && !expr.structTypeRef.getRef()) {
                this.diagnostics.add({
                    range: expr.range,
                    message: {
                        text: diagnosticMessages.TYPE_0_NOT_FOUND.text,
                        severity: DiagnosticSeverity.Error
                    },
                    args: [expr.structTypeRef.getName().text]
                });
            }
        } else if (expr instanceof UCDefaultStructLiteral) {
            expr.arguments?.forEach(arg => arg?.accept(this));
        } else if (expr instanceof UCObjectLiteral) {
            // TODO: verify class type by inheritance
            const classSymbol = expr.classRef.getRef();
            if (typeof classSymbol === 'undefined') {
                // Let's not validate the object reference if we have no class reference.
                return;
            }

            expr.classRef.accept(this);
            const objectSymbol = expr.classRef.baseType?.getRef();
            if (config.checkTypes && objectSymbol) {
                if (classSymbol === IntrinsicClass && !(isClass(objectSymbol))) {
                    this.pushError(expr.classRef.id.range, `Type of '${objectSymbol.getPath()}' is not a Class.`);
                } else if (classSymbol === IntrinsicEnum && !(isEnumSymbol(objectSymbol))) {
                    this.pushError(expr.classRef.id.range, `Type of '${objectSymbol.getPath()}' is not an Enum.`);
                }
            }
        } else if (expr instanceof UCArrayCountExpression) {
            // TODO: Validate that type is a static array
            expr.argument?.accept(this);
        } else if (expr instanceof UCNameOfExpression) {
            // TODO: Validate type
            expr.argument?.accept(this);
        } else if (expr instanceof UCSizeOfLiteral) {
            expr.argumentRef?.accept(this);
        } else if (expr instanceof UCNewExpression) {
            expr.arguments?.forEach(arg => arg.accept(this));
            this.checkArguments(IntrinsicNewOperator, expr, expr.arguments);

            expr.expression.accept(this);

            expr.constructorArguments?.forEach(arg => arg.accept(this));
            this.checkArguments(IntrinsicClassConstructor, expr.expression, expr.constructorArguments);
        }
    }

    private checkArguments(
        symbol: UCMethodSymbol,
        expr: IExpression,
        args: IExpression[] | undefined,
        inferredType?: ITypeSymbol
    ) {
        let i = 0;
        let passedArgumentsCount = 0; // excluding optional parameters.

        if (args) for (; i < args.length; ++i) {
            const arg = args[i];
            const param = symbol.params?.[i];
            if (!param) {
                this.pushError(arg.range, `Unexpected argument!`);
                ++passedArgumentsCount;
                continue;
            }

            if (!param.hasAnyModifierFlags(ModifierFlags.Optional)) {
                ++passedArgumentsCount;
                if (arg instanceof UCEmptyArgument) {
                    this.pushError(arg.range,
                        `An argument for non-optional parameter '${param.getName().text}' is missing.`
                    );
                    continue;
                }
            }

            if (arg instanceof UCEmptyArgument) {
                continue;
            }

            const argType = arg.getType();
            if (!argType) {
                // We already have generated an error diagnostic when type is an error.
                // Thus we can skip further skips that would only overload the programmer.
                continue;
            }

            if ((param.type.flags & ModifierFlags.Out) !== 0) {
                const argSymbol = arg.getMemberSymbol();
                if (argSymbol === Array_LengthProperty) {
                    this.pushError(arg.range,
                        `Cannot pass array property 'Length' to an 'Out' parameter.`
                    );
                }
            }

            if (!config.checkTypes) {
                continue;
            }

            const paramType = (param.getType() === StaticMetaType
                ? undefined
                : param.getType()
            ) ?? inferredType;

            // We'll play nice by not pushing any errors if the method's param has no found or defined type,
            // -- the 'type not found' error will suffice.
            if (!paramType) {
                continue;
            }

            const destTypeKind = paramType.getTypeKind();
            if (destTypeKind === UCTypeKind.Delegate) {
                const argSymbol = resolveType(argType).getRef<UCDelegateSymbol>();
                const paramSymbol = resolveType(paramType).getRef<UCDelegateSymbol>();
                if (argSymbol && isFunction(argSymbol) &&
                    paramSymbol && isFunction(paramSymbol)
                    && !areMethodsCompatible(paramSymbol, argSymbol)) {
                    this.diagnostics.add({
                        range: arg.range,
                        message: diagnosticMessages.DELEGATE_IS_INCOMPATIBLE,
                        args: [argSymbol.getPath(), paramSymbol.getPath()]
                    });
                }
            }

            const report = typesMatch(argType, paramType, TypeMatchFlags.Generalize);
            if (report > 0) {
                continue;
            }

            const inputArgumentTypeKind = argType.getTypeKind();
            const classTypesToCheck = 1 << UCTypeKind.Object | 1 << UCTypeKind.Interface;
            if ((1 << inputArgumentTypeKind & classTypesToCheck) & (1 << destTypeKind & classTypesToCheck)) {
                // be silent for unresolved classes.
                if (resolveType(paramType).getTypeKind() === UCTypeKind.Error ||
                    resolveType(argType).getTypeKind() === UCTypeKind.Error) {
                    continue;
                }

                this.diagnostics.add({
                    range: arg.range,
                    message: diagnosticMessages.ARGUMENT_CLASS_IS_INCOMPATIBLE,
                    args: [
                        typeToDisplayString(argType),
                        typeToDisplayString(paramType)
                    ]
                });

            } else {
                this.diagnostics.add({
                    range: arg.range,
                    message: diagnosticMessages.ARGUMENT_IS_INCOMPATIBLE,
                    args: [
                        typeToDisplayString(argType),
                        typeToDisplayString(paramType)
                    ]
                });
            }
        }

        if (!symbol.params) {
            return;
        }

        // Calc if not cached already
        let requiredParamsCount = symbol.requiredParamsCount ?? 0;
        if (typeof symbol.requiredParamsCount === 'undefined') for (; requiredParamsCount < symbol.params.length; ++requiredParamsCount) {
            if (symbol.params[requiredParamsCount].hasAnyModifierFlags(ModifierFlags.Optional)) {
                break;
            }

            symbol.requiredParamsCount = requiredParamsCount;
        }

        // When we have more params than required, we'll catch an unexpected argument error, see above.
        if (requiredParamsCount && passedArgumentsCount < requiredParamsCount) {
            const totalPassedParamsCount = i;
            this.pushError(expr.range, `Expected ${requiredParamsCount} arguments, but got ${totalPassedParamsCount}.`);
        }
    }

    private pushError(range: Range, text: string): void {
        this.diagnostics.add({ range, message: { text, severity: DiagnosticSeverity.Error } });
    }
}

function createExpectedTypeMessage(destType: UCTypeKind, inputType: UCTypeKind): IDiagnosticMessage {
    return {
        text: `Expected type '${typeKindToDisplayString(destType)}', but got type '${typeKindToDisplayString(inputType)}'`,
        severity: DiagnosticSeverity.Error
    };
}

function createTypeCannotBeAssignedToMessage(destType: UCTypeKind, inputType: UCTypeKind): IDiagnosticMessage {
    return {
        text: `Type '${typeKindToDisplayString(inputType)}' is not assignable to type '${typeKindToDisplayString(destType)}'`,
        severity: DiagnosticSeverity.Error
    };
}
