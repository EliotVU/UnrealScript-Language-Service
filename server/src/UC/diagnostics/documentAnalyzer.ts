import { DiagnosticSeverity, Range } from 'vscode-languageserver';

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
    UCObjectLiteral,
    UCParenthesizedExpression,
    UCPropertyAccessExpression,
    UCSizeOfLiteral,
    UCSuperExpression,
} from '../expressions';
import { config, getDocumentById, UCGeneration } from '../indexer';
import { toName } from '../name';
import { NAME_ENUMCOUNT, NAME_NONE, NAME_STATE, NAME_STRUCT } from '../names';
import {
    UCAssertStatement,
    UCBlock,
    UCCaseClause,
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
import {
    areMethodsCompatibleWith,
    Array_LengthProperty,
    ArrayIterator,
    ClassModifierFlags,
    ContextInfo,
    IntrinsicClass,
    IntrinsicEnum,
    isClass,
    isDelegateSymbol,
    isEnumSymbol,
    isEnumTagSymbol,
    isField,
    isFunction,
    isMethodSymbol,
    isStateSymbol,
    isTypeSymbol,
    ITypeSymbol,
    MethodFlags,
    ModifierFlags,
    resolveType,
    StaticBoolType,
    StaticDelegateType,
    StaticIntType,
    StaticMetaType,
    StaticNameType,
    TypeKindToName,
    typesMatch,
    UCArchetypeSymbol,
    UCArrayTypeSymbol,
    UCClassSymbol,
    UCConstSymbol,
    UCDelegateSymbol,
    UCDelegateTypeSymbol,
    UCEnumMemberSymbol,
    UCEnumSymbol,
    UCFieldSymbol,
    UCInterfaceSymbol,
    UCMatchFlags,
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
} from '../Symbols';
import { DefaultSymbolWalker } from '../symbolWalker';
import { DiagnosticCollection, IDiagnosticMessage } from './diagnostic';
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
                range: document.class.getRange(),
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

    visitQualifiedType(symbol: UCQualifiedTypeSymbol) {
        symbol.left?.accept(this);
        if (symbol.left && !symbol.left.getRef()) {
            return;
        }
        symbol.type.accept(this);
    }

    visitObjectType(symbol: UCObjectTypeSymbol) {
        super.visitObjectType(symbol);

        const referredSymbol = symbol.getRef();
        if (!referredSymbol) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: diagnosticMessages.TYPE_0_NOT_FOUND,
                args: [symbol.getName().text]
            });
        }
    }

    visitArrayType(symbol: UCArrayTypeSymbol) {
        super.visitArrayType(symbol);
        // TODO: Check for valid array types
    }

    visitDelegateType(symbol: UCDelegateTypeSymbol) {
        super.visitDelegateType(symbol);
    }

    visitInterface(symbol: UCInterfaceSymbol) {
        if (!this.isAllowed(UCSymbolKind.Interface)) {
            this.diagnostics.add({
                range: symbol.getRange(),
                message: {
                    text: `Interface cannot be declared here!`,
                    severity: DiagnosticSeverity.Error
                }
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
                args: [className.text, this.document.fileName]
            });
        }
    }

    visitClass(symbol: UCClassSymbol) {
        if (!this.isAllowed(UCSymbolKind.Class)) {
            this.diagnostics.add({
                range: symbol.getRange(),
                message: {
                    text: `Class cannot be declared here!`,
                    severity: DiagnosticSeverity.Error
                }
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
                args: [className.text, this.document.fileName]
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
                    range: symbol.getRange(),
                    message: diagnosticMessages.IMPLEMENTS_IS_INCOMPATIBLE,
                });
            }
        }
    }

    visitConst(symbol: UCConstSymbol) {
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

    visitEnum(symbol: UCEnumSymbol) {
        if (!this.isAllowed(UCSymbolKind.Enum)) {
            this.diagnostics.add({
                range: symbol.getRange(),
                message: {
                    text: `Struct must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        if (typeof symbol.children === 'undefined') {
            this.diagnostics.add({
                range: symbol.getRange(),
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

    visitEnumMember(symbol: UCEnumMemberSymbol) {
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
                    text: `Duplicate enumeration tag '${symbol.getName().text}'.`,
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

    visitScriptStruct(symbol: UCScriptStructSymbol) {
        if (!this.isAllowed(UCSymbolKind.ScriptStruct)) {
            this.diagnostics.add({
                range: symbol.getRange(),
                message: {
                    text: `Struct must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }

        this.pushScope(symbol);
        super.visitScriptStruct(symbol);

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

    visitProperty(symbol: UCPropertySymbol) {
        if (!this.isAllowed(UCSymbolKind.Property)) {
            this.diagnostics.add({
                range: symbol.getRange(),
                message: {
                    text: `Property must be declared before any function or state.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
        super.visitProperty(symbol);

        if (symbol.isFixedArray() && symbol.arrayDimRange) {
            const arraySize = symbol.getArrayDimSize();
            if (!arraySize) {
                this.diagnostics.add({
                    range: symbol.arrayDimRange,
                    message: {
                        text: `Bad array size, try refer to a type that can be evaluated to an integer!`,
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
            const baseType = symbol.isDynamicArray()
                ? symbol.type.baseType
                : symbol.isFixedArray()
                    ? symbol.type
                    : undefined;

            if (baseType) {
                const arrayType = baseType.getTypeKind();
                if (arrayType === UCTypeKind.Bool || arrayType === UCTypeKind.Array) {
                    this.diagnostics.add({
                        range: baseType.id.range,
                        message: {
                            text: `Illegal array type '${baseType.id.name.text}'.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            }

            // TODO: Should define a custom type class for arrays, so that we can analyze it right there.
        }
    }

    visitMethod(symbol: UCMethodSymbol) {
        this.pushScope(symbol);
        this.suspendState();
        this.setAllowed(UCMethodSymbol.allowedKindsMask);
        super.visitMethod(symbol);
        this.revokeAllowed(UCSymbolKind.Property);
        this.resumeState();

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

        if (symbol.isOperatorKind()) {
            if (!symbol.hasAnySpecifierFlags(MethodFlags.Final)) {
                this.diagnostics.add({
                    range: symbol.id.range,
                    message: {
                        text: `Operator must be declared as 'final'.`,
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

    visitState(symbol: UCStateSymbol) {
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
                    message: { text: `'Extends' not allowed here: The state already overrides state '{0}'` },
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

    visitParameter(symbol: UCParamSymbol) {
        super.visitParameter(symbol);

        if (symbol.defaultExpression) {
            if (config.generation === UCGeneration.UC3) {
                if (!symbol.hasAnyModifierFlags(ModifierFlags.Optional)) {
                    this.diagnostics.add({
                        range: symbol.id.range,
                        message: {
                            text: `To assign a default value to a parameter, it must be marked as 'optional'.`,
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
                        text: `'ref' is only available in some versions of UC3 (such as XCom2).`,
                        severity: DiagnosticSeverity.Error
                    },
                });
            }
        }
    }

    visitRepIfStatement(stm: UCRepIfStatement) {
        super.visitRepIfStatement(stm);
        const refs = stm.symbolRefs;
        if (typeof refs === 'undefined') {
            this.diagnostics.add({
                range: stm.getRange(),
                message: {
                    text: `Missing members!`,
                    severity: DiagnosticSeverity.Error
                }
            });
            return undefined;
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
                            text: `Variable or Function '${symbol.getPath()}' needs to be declared in class '${this.document.class!.getPath()}'!`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            }
        }
    }

    visitArchetypeSymbol(symbol: UCArchetypeSymbol) {
        this.pushScope(symbol.super ?? symbol);
        if (symbol.getName() === NAME_NONE) {
            this.diagnostics.add({
                range: symbol.id.range,
                message: {
                    text: `Object declaration is missing a name!`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
        // Disabled because we don't want to analyze object children, because each child is already registered as a statement!
        // super.visitStructBase(symbol);
        if (symbol.block) {
            symbol.block.accept(this);
        }
        this.popScope();
    }

    visitBlock(symbol: UCBlock) {
        for (const statement of symbol.statements) if (statement) {
            try {
                statement.accept?.(this);
            } catch (err) {
                const range = statement.getRange();
                console.error('Error during analysis at', this.context ? this.context.getPath() : '???', range, err);
            }
        }
        return undefined;
    }

    private verifyStatementExpression(stm: UCExpressionStatement) {
        if (!stm.expression) {
            this.diagnostics.add({
                range: stm.getRange(),
                message: diagnosticMessages.EXPECTED_EXPRESSION
            });
        }
    }

    private verifyStatementBooleanCondition(stm: UCExpressionStatement) {
        if (!config.checkTypes)
            return;

        if (stm.expression) {
            const type = stm.expression.getType();
            if (type && !typesMatch(type, StaticBoolType)) {
                this.diagnostics.add({
                    range: stm.expression.getRange(),
                    message: createExpectedTypeMessage(UCTypeKind.Bool, type.getTypeKind())
                });
            }
        }
    }

    visitIfStatement(stm: UCIfStatement) {
        super.visitIfStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
    }

    visitWhileStatement(stm: UCWhileStatement) {
        super.visitWhileStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
    }

    visitSwitchStatement(stm: UCSwitchStatement) {
        super.visitSwitchStatement(stm);
        this.verifyStatementExpression(stm);
    }

    visitDoUntilStatement(stm: UCDoUntilStatement) {
        super.visitDoUntilStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
    }

    // TODO: Test if any of the three expression can be omitted?
    visitForStatement(stm: UCForStatement) {
        super.visitForStatement(stm);

        if (stm.init) {
            // TODO: Check if the operator has an "out" parameter?
            const hasAffect = true;
            if (!hasAffect) {
                this.diagnostics.add({
                    range: stm.init.getRange(),
                    message: {
                        text: `Expression has no effect.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        } else {
            this.diagnostics.add({
                range: stm.getRange(),
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
                range: stm.getRange(),
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
                    range: stm.next.getRange(),
                    message: {
                        text: `Expression has no effect.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            }
        } else {
            this.diagnostics.add({
                range: stm.getRange(),
                message: {
                    text: `Missing next expression.`,
                    severity: DiagnosticSeverity.Error
                }
            });
        }
    }

    // TODO: Verify we have an iterator function or array(UC3+).
    visitForEachStatement(stm: UCForEachStatement) {
        super.visitForEachStatement(stm);
        this.verifyStatementExpression(stm);

        if (stm.expression) {
            if (!(stm.expression instanceof UCCallExpression)) {
                this.diagnostics.add({
                    range: stm.expression.getRange(),
                    message: {
                        text: `Expression does not evaluate to an iteratable.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
                return;
            } else if (!stm.expression.arguments) {
                this.diagnostics.add({
                    range: stm.expression.getRange(),
                    message: {
                        text: `Missing iterator arguments.`,
                        severity: DiagnosticSeverity.Error
                    }
                });
                return;
            }

            const symbol = stm.expression?.getMemberSymbol();
            if (symbol) {
                // Cannot iterate on the return result of a function expression.
                if (isFunction(symbol)) {
                    if ((symbol.specifiers & MethodFlags.Iterator) == 0) {
                        this.diagnostics.add({
                            range: stm.expression.getRange(),
                            message: {
                                text: `Function is not an iterator.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                    }
                } else if (config.checkTypes) {
                    if (config.generation != UCGeneration.UC3) {
                        this.diagnostics.add({
                            range: stm.expression.getRange(),
                            message: {
                                text: `Type '${typeKindToDisplayString(stm.expression.getType()!.getTypeKind())}' cannot be iterated. Expected an iterator function.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                        return;
                    }

                    if (stm.expression.getType()?.getTypeKind() != UCTypeKind.Array) {
                        this.diagnostics.add({
                            range: stm.expression.getRange(),
                            message: {
                                text: `Type '${typeKindToDisplayString(stm.expression.getType()!.getTypeKind())}' cannot be iterated. Expected an iterator function or dynamic array.`,
                                severity: DiagnosticSeverity.Error
                            }
                        });
                    } else {
                        // check intrinsic arguments
                        const arrayInnerType = ((symbol as UCFieldSymbol).getType() as UCArrayTypeSymbol).baseType;
                        this.checkArguments(ArrayIterator, stm.expression, arrayInnerType);
                    }
                }
            }
        }
    }

    visitCaseClause(stm: UCCaseClause) {
        super.visitCaseClause(stm);
        this.verifyStatementExpression(stm);
    }

    visitGotoStatement(stm: UCGotoStatement) {
        this.verifyStatementExpression(stm);

        if (!config.checkTypes)
            return;

        if (stm.expression) {
            const type = stm.expression.getType();
            if (type && !typesMatch(type, StaticNameType)) {
                this.diagnostics.add({
                    range: stm.expression.getRange(),
                    message: createExpectedTypeMessage(UCTypeKind.Name, type.getTypeKind())
                });
            }
        }
    }

    visitReturnStatement(stm: UCReturnStatement) {
        super.visitReturnStatement(stm);

        if (!config.checkTypes)
            return;

        if (this.context && isFunction(this.context)) {
            const functionReturnType = this.context.getType();
            if (stm.expression) {
                const returnType = stm.expression.getType();
                if (!functionReturnType) {
                    // TODO: No return expression expected!
                } else {
                    if (returnType && !typesMatch(returnType, functionReturnType)) {
                        this.diagnostics.add({
                            range: stm.getRange(),
                            message: createTypeCannotBeAssignedToMessage(functionReturnType.getTypeKind(), returnType.getTypeKind())
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

    visitAssertStatement(stm: UCAssertStatement) {
        super.visitAssertStatement(stm);

        this.verifyStatementExpression(stm);
        this.verifyStatementBooleanCondition(stm);
    }

    visitExpression(expr: IExpression) {
        if (expr instanceof UCParenthesizedExpression) {
            expr.expression?.accept(this);
        } else if (expr instanceof UCMetaClassExpression) {
            expr.classRef?.accept(this);
            expr.expression?.accept(this);
            // TODO: verify class type by inheritance
        } else if (expr instanceof UCCallExpression) {
            this.state.hasArguments = true;
            expr.expression.accept(this);
            this.state.hasArguments = false;
            expr.arguments?.forEach(arg => arg.accept(this));

            const type = expr.expression.getType();
            const symbol = type?.getRef();
            if (symbol) {
                if (isFunction(symbol)) {
                    // FIXME: inferred type, this is unfortunately complicated :(
                    this.checkArguments(symbol, expr);
                } else if (isTypeSymbol(symbol)) {
                    const firstArgument = expr.arguments && expr.arguments.length === 1
                        ? expr.arguments[0]
                        : undefined;
                    const argumentType = firstArgument?.getType();
                    if (argumentType) {
                        const canPerformConversion = typesMatch(symbol, argumentType, UCMatchFlags.Coerce);
                        if (!canPerformConversion) {
                            this.diagnostics.add({
                                range: expr.getRange(),
                                message: {
                                    text: `Type '${typeKindToDisplayString(argumentType.getTypeKind())}' cannot be cast to type '${typeKindToDisplayString(symbol.getTypeKind())}'`,
                                    severity: DiagnosticSeverity.Error
                                }
                            });
                        }
                    }
                }
            }
            // TODO: Validate if expressed symbol is callable,
            // i.e. either a 'Function/Delegate', 'Class', or a 'Struct' like Vector/Rotator.
        } else if (expr instanceof UCElementAccessExpression) {
            if (expr.expression) {
                expr.expression.accept(this);
                if (config.checkTypes) {
                    const type = expr.getType();
                    if (!type) {
                        this.diagnostics.add({
                            range: expr.getRange(),
                            message: {
                                text: `Type of '${expr.getMemberSymbol()?.getPath()}' is not a valid array.`,
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
                        if (!typesMatch(type, StaticIntType)) {
                            this.diagnostics.add({
                                range: expr.argument.getRange(),
                                message: {
                                    text: `Element access expression type is invalid.`,
                                    severity: DiagnosticSeverity.Error
                                }
                            });
                        }
                    }
                }
            } else {
                this.diagnostics.add({
                    range: expr.getRange(),
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
            const operatorSymbol = expr.operator.getRef();
            if (!operatorSymbol) {
                this.diagnostics.add({
                    range: expr.operator.getRange(),
                    message: {
                        text: `Invalid unary operator '{0}'.`,
                        severity: DiagnosticSeverity.Error
                    },
                    args: [expr.operator.getName().text]
                });
            }
        } else if (expr instanceof UCBinaryOperatorExpression) {
            if (expr.left) {
                expr.left.accept(this);

                const type = expr.left.getType();
                this.state.contextType = type;
            } else {
                this.pushError(expr.getRange(), "Missing left-hand side expression!");
                return;
            }
            if (expr.right) {
                expr.right.accept(this);
            } else {
                this.pushError(expr.getRange(), "Missing right-hand side expression!");
                return;
            }

            if (!(expr instanceof UCAssignmentOperatorExpression || expr instanceof UCDefaultAssignmentExpression)) {
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

            const valueTypeKind = valueType.getTypeKind();
            const letSymbol = expr.left.getMemberSymbol();
            if (!(letSymbol && isField(letSymbol))) {
                this.pushError(
                    expr.left.getRange(),
                    `The left-hand side of an assignment expression must be a variable.`
                );
                return;
            }

            let matchFlags: UCMatchFlags = UCMatchFlags.None;
            if (expr instanceof UCDefaultAssignmentExpression) {
                matchFlags |= UCMatchFlags.T3D;
            }

            if (isMethodSymbol(letSymbol)) {
                this.diagnostics.add({
                    range: expr.left.getRange(),
                    message: {
                        text: `Cannot assign to '${letSymbol.getName().text}' because it is a function. Did you mean to assign a delegate?`,
                        severity: DiagnosticSeverity.Error
                    }
                });
            } else if (letSymbol.hasAnyModifierFlags(ModifierFlags.ReadOnly)) {
                if (matchFlags & UCMatchFlags.T3D) {
                    // TODO:
                } else {
                    this.diagnostics.add({
                        range: expr.left.getRange(),
                        message: {
                            text: `Cannot assign to '${letSymbol.getName().text}' because it is a constant.`,
                            severity: DiagnosticSeverity.Error
                        }
                    });
                }
            } else if (letSymbol.isFixedArray()) {
                // FIXME: Distinguish dimProperty with and without a [].
                // Properties with a defined array dimension cannot be assigned!
                // this.diagnostics.add({
                //     range: expr.left.getRange(),
                //     message: {
                //         text: `Cannot assign to '${symbol.getName()}' because it is a fixed array.`,
                //         severity: DiagnosticSeverity.Error
                //     }
                // });
            } else if (
                // Both Native and Transient modifiers will skip serialization, except for transient since UE3? (needs to be tested thoroughly).
                ((letSymbol.modifiers & ModifierFlags.Native) !== 0
                    || ((letSymbol.modifiers & ModifierFlags.Transient) !== 0
                        && config.generation !== UCGeneration.UC3)
                ) && (matchFlags & UCMatchFlags.T3D)
            ) {
                const modifiers = letSymbol
                    .buildModifiers(letSymbol.modifiers & (ModifierFlags.Native | ModifierFlags.Transient))
                    .join(' ');
                this.diagnostics.add({
                    range: expr.left.getRange(),
                    message: {
                        text: `(${modifiers}) '${letSymbol.getName().text}' will not be serialized.`,
                        severity: DiagnosticSeverity.Warning
                    }
                });
            }

            if (config.checkTypes) {
                if (expr instanceof UCAssignmentOperatorExpression) {
                    if (letType.getTypeKind() === UCTypeKind.Delegate) {
                        // TODO: Cleanup duplicate code when binary-operator types are resolved properly.
                        if (!typesMatch(valueType, StaticDelegateType)) {
                            this.diagnostics.add({
                                range: expr.right.getRange(),
                                message: createTypeCannotBeAssignedToMessage(UCTypeKind.Delegate, valueTypeKind),
                            });
                        } else {
                            const letTypeRef = resolveType(letType).getRef<UCDelegateSymbol>();
                            const valueTypeRef = resolveType(valueType).getRef<UCMethodSymbol>();
                            if (letTypeRef && isDelegateSymbol(letTypeRef)
                                && valueTypeRef && isFunction(valueTypeRef)
                                && !areMethodsCompatibleWith(letTypeRef, valueTypeRef)) {
                                this.diagnostics.add({
                                    range: expr.right.getRange(),
                                    message: diagnosticMessages.DELEGATE_IS_INCOMPATIBLE,
                                    args: [valueTypeRef.getPath(), letSymbol.getPath()]
                                });
                            }
                        }
                    } else if (!typesMatch(valueType, letType, matchFlags)) {
                        this.diagnostics.add({
                            range: expr.right.getRange(),
                            message: createTypeCannotBeAssignedToMessage(letType.getTypeKind(), valueTypeKind),
                        });
                    }
                }
            }
        } else if (expr instanceof UCDefaultMemberCallExpression) {
            expr.propertyMember.accept(this);

            const type = expr.propertyMember.getType();
            if (type) {
                if (!UCArrayTypeSymbol.is(type)) {
                    this.pushError(expr.operationMember.getRange(), `Array operations are only allowed on dynamic arrays.`);
                } else {
                    const operationType = expr.operationMember;
                    const operationSymbol = operationType.getRef();
                    if (operationSymbol && isFunction(operationSymbol)) {
                        this.checkArguments(operationSymbol, expr, expr.getType());
                    } else {
                        this.pushError(operationType.getRange(), `Unrecognized array operation '${operationType.id.name.text}'.`);
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
                        range: expr.getRange(),
                        message: {
                            text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text, this.context.getPath()]
                    });
                } else {
                    this.diagnostics.add({
                        range: expr.getRange(),
                        message: {
                            text: diagnosticMessages.COULDNT_FIND_0.text,
                            severity: DiagnosticSeverity.Error
                        },
                        args: [expr.id.name.text]
                    });
                }
            }
        } else if (expr instanceof UCMemberExpression) {
            if (!expr.type && this.context) {
                this.diagnostics.add({
                    range: expr.getRange(),
                    message: {
                        text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
                        severity: DiagnosticSeverity.Error
                    },
                    args: [expr.id.name.text, this.context.getPath()]
                });
            }
        } else if (expr instanceof UCSuperExpression) {
            // TODO: verify class type by inheritance
            if (expr.structTypeRef && !expr.structTypeRef.getRef()) {
                this.diagnostics.add({
                    range: expr.getRange(),
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
            const castSymbol = expr.castRef.getRef();
            expr.castRef.accept(this);

            if (expr.objectRef) {
                expr.objectRef.accept(this);

                const objectSymbol = expr.objectRef.getRef();
                if (config.checkTypes && objectSymbol) {
                    if (castSymbol === IntrinsicClass && !(isClass(objectSymbol))) {
                        this.pushError(expr.objectRef.id.range, `Type of '${objectSymbol.getPath()}' is not a class!`);
                    } else if (castSymbol === IntrinsicEnum && !(isEnumSymbol(objectSymbol))) {
                        this.pushError(expr.objectRef.id.range, `Type of '${objectSymbol.getPath()}' is not an enum!`);
                    }
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
        }
    }

    private checkArguments(symbol: UCMethodSymbol, expr: UCCallExpression | UCDefaultMemberCallExpression, inferredType?: ITypeSymbol) {
        let i = 0;
        let passedArgumentsCount = 0; // excluding optional parameters.

        const args = expr.arguments;
        if (args) for (; i < args.length; ++i) {
            const arg = args[i];
            const param = symbol.params?.[i];
            if (!param) {
                this.pushError(arg.getRange(), `Unexpected argument!`);
                ++passedArgumentsCount;
                continue;
            }

            if (!param.hasAnyModifierFlags(ModifierFlags.Optional)) {
                ++passedArgumentsCount;
                if (arg instanceof UCEmptyArgument) {
                    this.pushError(arg.getRange(),
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

            // TODO: Push an error when passing literals to out parameters.
            if (param.hasAnyModifierFlags(ModifierFlags.Out)) {
                const argSymbol = arg.getMemberSymbol();
                // if (!argSymbol) {
                // 	this.pushError(
                // 		arg.getRange(),
                // 		`Non-resolved argument cannot be passed to an 'out' parameter.`)
                // 	);
                // } else
                if (argSymbol && isField(argSymbol)) {
                    if (argSymbol === Array_LengthProperty) {
                        this.pushError(arg.getRange(),
                            `Cannot pass array property 'Length' to an 'out' parameter.`
                        );
                    } else if (argSymbol.hasAnyModifierFlags(ModifierFlags.ReadOnly)) {
                        // FIXME: Apparently possible?
                        // this.pushError(arg.getRange(),
                        //     `Argument '${argSymbol.getName()}' cannot be passed to an 'out' parameter, because it is a constant.`
                        // );
                    }
                }
            }

            if (config.checkTypes) {
                const paramType = (param.getType() !== StaticMetaType ? param.getType() : undefined) ?? inferredType

                // We'll play nice by not pushing any errors if the method's param has no found or defined type,
                // -- the 'type not found' error will suffice.
                if (paramType) {
                    const destTypeKind = paramType.getTypeKind();
                    if (destTypeKind === UCTypeKind.Delegate) {
                        const argSymbol = resolveType(argType).getRef<UCDelegateSymbol>();
                        const paramSymbol = resolveType(paramType).getRef<UCDelegateSymbol>();
                        if (argSymbol && isFunction(argSymbol)
                            && paramSymbol && isFunction(paramSymbol)
                            && !areMethodsCompatibleWith(paramSymbol, argSymbol)) {
                            this.diagnostics.add({
                                range: arg.getRange(),
                                message: diagnosticMessages.DELEGATE_IS_INCOMPATIBLE,
                                args: [argSymbol.getPath(), paramType.getPath()]
                            });
                        }
                    }

                    if (!typesMatch(argType, paramType, UCMatchFlags.Coerce * Number(param.hasAnyModifierFlags(ModifierFlags.Coerce)))) {
                        this.diagnostics.add({
                            range: arg.getRange(),
                            message: diagnosticMessages.ARGUMENT_IS_INCOMPATIBLE,
                            args: [typeKindToDisplayString(argType.getTypeKind()), typeKindToDisplayString(destTypeKind)]
                        });
                    }
                }
            }
        }

        // When we have more params than required, we'll catch an unexpected argument error, see above.
        if (symbol.requiredParamsCount && passedArgumentsCount < symbol.requiredParamsCount) {
            const totalPassedParamsCount = i;
            this.pushError(expr.getRange(), `Expected ${symbol.requiredParamsCount} arguments, but got ${totalPassedParamsCount}.`);
        }
    }

    private pushError(range: Range, text: string): void {
        this.diagnostics.add({ range, message: { text, severity: DiagnosticSeverity.Error } });
    }
}

function createExpectedTypeMessage(destType: UCTypeKind, inputType: UCTypeKind): IDiagnosticMessage {
    return {
        text: `Expected type '${typeKindToDisplayString(destType)}', but got type '${typeKindToDisplayString(inputType)}'.`,
        severity: DiagnosticSeverity.Error
    };
}

function createTypeCannotBeAssignedToMessage(destType: UCTypeKind, inputType: UCTypeKind): IDiagnosticMessage {
    return {
        text: `Type '${typeKindToDisplayString(inputType)}' is not assignable to type '${typeKindToDisplayString(destType)}'.`,
        severity: DiagnosticSeverity.Error
    };
}

function typeKindToDisplayString(kind: UCTypeKind): string {
    return TypeKindToName.get(kind)!.text;
}