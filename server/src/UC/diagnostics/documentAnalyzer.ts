import { DiagnosticSeverity, Range } from 'vscode-languageserver';

import { UCDocument } from '../document';
import {
    IExpression, UCArrayCountExpression, UCArrayCountLiteral, UCAssignmentExpression,
    UCAssignmentOperatorExpression, UCBaseOperatorExpression, UCBinaryOperatorExpression,
    UCCallExpression, UCConditionalExpression, UCDefaultAssignmentExpression,
    UCDefaultMemberCallExpression, UCDefaultStructLiteral, UCElementAccessExpression,
    UCEmptyArgument, UCIdentifierLiteralExpression, UCMemberExpression, UCMetaClassExpression,
    UCNameOfLiteral, UCObjectLiteral, UCParenthesizedExpression, UCPropertyAccessExpression,
    UCSizeOfLiteral, UCSuperExpression
} from '../expressions';
import { config, UCGeneration } from '../indexer';
import { NAME_DELEGATE, NAME_NONE, NAME_STATE, NAME_STRUCT } from '../names';
import {
    UCAssertStatement, UCBlock, UCCaseClause, UCDoUntilStatement, UCExpressionStatement,
    UCForEachStatement, UCForStatement, UCIfStatement, UCReturnStatement, UCSwitchStatement,
    UCWhileStatement
} from '../statements';
import {
    getTypeFlagsName, IContextInfo, ITypeSymbol, LengthProperty, NativeClass, NativeEnum,
    StaticBoolType, typeMatchesFlags, UCArrayTypeSymbol, UCClassSymbol, UCConstSymbol,
    UCDelegateSymbol, UCDelegateTypeSymbol, UCEnumSymbol, UCFieldSymbol, UCMethodSymbol,
    UCObjectSymbol, UCObjectTypeSymbol, UCParamSymbol, UCPropertySymbol, UCQualifiedTypeSymbol,
    UCReplicationBlock, UCScriptStructSymbol, UCStateSymbol, UCStructSymbol, UCTypeFlags
} from '../Symbols';
import { DefaultSymbolWalker } from '../symbolWalker';
import { DiagnosticCollection, IDiagnosticMessage } from './diagnostic';
import * as diagnosticMessages from './diagnosticMessages.json';

export class DocumentAnalyzer extends DefaultSymbolWalker {
	private scopes: UCStructSymbol[] = [];
	private context?: UCStructSymbol;
	private state: IContextInfo = {};
	private cachedState: IContextInfo = {};

	constructor(private document: UCDocument, private diagnostics: DiagnosticCollection) {
		super();

		if (document.class) {
			this.pushScope(document.class);
			document.class.accept<any>(this);
		}
	}

	pushScope(context?: UCStructSymbol) {
		this.context = context;
		if (context) {
			this.scopes.push(context);
		}
	}

	popScope(): UCStructSymbol | undefined {
		this.scopes.pop();
		this.context = this.scopes[this.scopes.length - 1];
		return this.context;
	}

	resetState() {
		this.state = {};
	}

	suspendState() {
		this.cachedState = this.state;
		this.state = {};
	}

	resumeState() {
		this.state = this.cachedState;
	}

	visitQualifiedType(symbol: UCQualifiedTypeSymbol) {
		symbol.left?.accept<any>(this);
		if (symbol.left && !symbol.left.getRef()) {
			return symbol;
		}
		symbol.type.accept<any>(this);
		return symbol;
	}

	visitObjectType(symbol: UCObjectTypeSymbol) {
		super.visitObjectType(symbol);

		const referredSymbol = symbol.getRef();
		if (!referredSymbol) {
			this.diagnostics.add({
				range: symbol.id.range,
				message: diagnosticMessages.TYPE_0_NOT_FOUND,
				args: [symbol.getName().toString()]
			});
		}
		return symbol;
	}

	visitArrayType(symbol: UCArrayTypeSymbol) {
		super.visitArrayType(symbol);
		// TODO: Check for valid array types
		return symbol;
	}

	visitDelegateType(symbol: UCDelegateTypeSymbol) {
		super.visitDelegateType(symbol);

		if (config.checkTypes && symbol.baseType) {
			const referredSymbol = symbol.baseType.getRef();
			if (referredSymbol && !(referredSymbol instanceof UCDelegateSymbol)) {
				this.diagnostics.add({
					range: symbol.baseType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_DELEGATE.toString(), referredSymbol.getPath()]
				});
			}
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol) {
		super.visitClass(symbol);

		const className = symbol.getName();
		if (className.hash !== this.document.name.hash) {
			this.diagnostics.add({
				range: symbol.id.range,
				message: diagnosticMessages.CLASS_NAME_0_MUST_MATCH_DOCUMENT_NAME_1,
				args: [className.toString(), this.document.fileName]
			});
		}
		return symbol;
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
		return symbol;
	}

	visitEnum(symbol: UCEnumSymbol) {
		// Do nothing, we don't have any useful analytics for enum declarations yet!
		return symbol;
	}

	visitScriptStruct(symbol: UCScriptStructSymbol) {
		this.pushScope(symbol);
		super.visitScriptStruct(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getRef();
			if (referredSymbol && referredSymbol.getTypeFlags() !== UCTypeFlags.Struct) {
				this.diagnostics.add({
					range: symbol.extendsType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_STRUCT.toString(), referredSymbol.getPath()]
				});
			}
		}
		this.popScope();
		return symbol;
	}

	visitProperty(symbol: UCPropertySymbol) {
		super.visitProperty(symbol);

		if (symbol.isFixedArray() && symbol.arrayDimRange) {
			const arraySize = symbol.getArrayDimSize();
			if (!arraySize) {
				this.diagnostics.add({
					range: symbol.arrayDimRange,
					message: {
						text: `Bad array size, try refer to a type that can be evaulated to an integer!`,
						severity: DiagnosticSeverity.Error
					}
				});
			} else if (arraySize > 2048 || arraySize <= 1) {
				this.diagnostics.add({
					range: symbol.arrayDimRange,
					message: {
						text: `Illegal array size, must be between 2-2048`,
						severity: DiagnosticSeverity.Error
					}
				});
			}
		}

		if (config.checkTypes) {
			const baseType = symbol.isDynamicArray()
				? (symbol.type! as UCArrayTypeSymbol).baseType
				: symbol.isFixedArray()
					? symbol.type
					: undefined;

			if (baseType) {
				const typeFlags = baseType.getTypeFlags();
				if (typeFlags && ((typeFlags & (UCTypeFlags.Bool | UCTypeFlags.Array)) !== 0)) {
					this.diagnostics.add({
						range: baseType.id.range,
						message: {
							text: `Illegal array type '${baseType.id.name}'`,
							severity: DiagnosticSeverity.Error
						}
					});
				}
			}

			// TODO: Should define a custom type class for arrays, so that we can analyze it right there.
		}

		return symbol;
	}

	visitMethod(symbol: UCMethodSymbol) {
		this.pushScope(symbol);
		super.visitMethod(symbol);

		if (symbol.params) {
			for (var requiredParamsCount = 0; requiredParamsCount < symbol.params.length; ++requiredParamsCount) {
				if (symbol.params[requiredParamsCount].isOptional()) {
					// All trailing params after the first optional param, are required to be declared as 'optional' too.
					for (let i = requiredParamsCount + 1; i < symbol.params.length; ++i) {
						const param = symbol.params[i];
						if (param.isOptional()) {
							continue;
						}

						this.diagnostics.add({
							range: param.id.range,
							message: {
								text: `Parameter '${param.getName()}' must be marked 'optional' after an optional parameter.`,
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
			if (!symbol.isFinal()) {
				this.diagnostics.add({
					range: symbol.id.range,
					message: {
						text: `Operator must be declared as 'final'.`,
						severity: DiagnosticSeverity.Error
					}
				});
			}

			if (symbol.isOperator()) {
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
		return symbol;
	}

	visitState(symbol: UCStateSymbol) {
		this.pushScope(symbol);
		super.visitState(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getRef();
			if (referredSymbol && referredSymbol.getTypeFlags() !== UCTypeFlags.State) {
				this.diagnostics.add({
					range: symbol.extendsType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_STATE.toString(), referredSymbol.getPath()]
				});
			}
		}

		if (symbol.ignoreRefs) for (const ref of symbol.ignoreRefs) {
			// TODO: How does uscript behave when an operator is referred?
			const referredSymbol = ref.getRef();
			if (!referredSymbol) {
				this.diagnostics.add({
					range: ref.id.range,
					message: diagnosticMessages.COULDNT_FIND_0,
					args: [ref.getName().toString()]
				});
			} else if (referredSymbol instanceof UCMethodSymbol) {
				if (referredSymbol.isFinal()) {
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
						text: `'${referredSymbol.getName()}' is not a function.`,
						severity: DiagnosticSeverity.Error
					}
				});
			}
		}
		this.popScope();
		return symbol;
	}

	visitParameter(symbol: UCParamSymbol) {
		super.visitParameter(symbol);

		if (symbol.defaultExpression) {
			if (config.generation === UCGeneration.UC3) {
				if (!symbol.isOptional()) {
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
			if (symbol.isRef()) {
				this.diagnostics.add({
					range: symbol.id.range,
					message: {
						text: `'ref' is only available in some versions of UC3 (such as XCom2).`,
						severity: DiagnosticSeverity.Error
					},
				});
			}
		}
		return symbol;
	}

	visitReplicationBlock(symbol: UCReplicationBlock) {
		this.pushScope(this.document.class || symbol);
		super.visitReplicationBlock(symbol);

		for (let symbolRef of symbol.symbolRefs.values()) {
			const symbol = symbolRef.getRef();
			if (!symbol) {
				this.diagnostics.add({
					range: symbolRef.id.range,
					message: {
						text: `Variable '${symbolRef.getName()}' not found!`,
						severity: DiagnosticSeverity.Error
					}
				});
				continue;
			}

			if ((symbol.getTypeFlags() & UCTypeFlags.Replicatable) !== 0) {
				// i.e. not defined in the same class as where the replication statement resides in.
				if (symbol.outer !== this.document.class) {
					this.diagnostics.add({
						range: symbolRef.id.range,
						message: {
							text: `Variable or Function '${symbol.getPath()}' needs to be declared in class '${this.document.class!.getPath()}'!`,
							severity: DiagnosticSeverity.Error
						}
					});
				}
			} else {
				this.diagnostics.add({
					range: symbolRef.id.range,
					message: {
						text: `Type of '${symbol.getName()}' is neither a variable nor function!`,
						severity: DiagnosticSeverity.Error
					}
				});
			}
		}
		this.popScope();
		return symbol;
	}

	visitObjectSymbol(symbol: UCObjectSymbol) {
		this.pushScope(symbol.super || symbol);
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
			symbol.block.accept<any>(this);
		}
		this.popScope();
		return symbol;
	}

	visitBlock(symbol: UCBlock) {
		for (let statement of symbol.statements) if (statement) {
			try {
				statement.accept<any>(this);
			} catch (err) {
				console.error('Hit a roadblock while analyzing a statement', this.context ? this.context.getPath() : '???', err);
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

	visitIfStatement(stm: UCIfStatement) {
		super.visitIfStatement(stm);

		this.verifyStatementExpression(stm);
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, StaticBoolType)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
		return undefined;
	}

	visitWhileStatement(stm: UCWhileStatement) {
		super.visitWhileStatement(stm);

		this.verifyStatementExpression(stm);
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, StaticBoolType)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
		return undefined;
	}

	visitSwitchStatement(stm: UCSwitchStatement) {
		super.visitSwitchStatement(stm);

		this.verifyStatementExpression(stm);
		return undefined;
	}

	visitDoUntilStatement(stm: UCDoUntilStatement) {
		super.visitDoUntilStatement(stm);

		this.verifyStatementExpression(stm);
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, StaticBoolType)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
		return undefined;
	}

	// TODO: Test if any of the three expression can be omitted?
	visitForStatement(stm: UCForStatement) {
		super.visitForStatement(stm);

		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, StaticBoolType)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
		return undefined;
	}

	// TODO: Verify we have an iterator function or array(UC3+).
	visitForEachStatement(stm: UCForEachStatement) {
		super.visitForEachStatement(stm);

		this.verifyStatementExpression(stm);
		return undefined;
	}

	visitCaseClause(stm: UCCaseClause) {
		super.visitCaseClause(stm);

		this.verifyStatementExpression(stm);
		return undefined;
	}

	visitReturnStatement(stm: UCReturnStatement) {
		super.visitReturnStatement(stm);

		if (!config.checkTypes)
            return undefined;

		if (this.context instanceof UCMethodSymbol) {
			const expectedType = this.context.getType();
			if (stm.expression) {
				const type = stm.expression.getType();
				if (!expectedType) {
					// TODO: No return expression expected!
				} else {
					const flags = expectedType.getTypeFlags();
					if (!typeMatchesFlags(type, expectedType)) {
						this.diagnostics.add({
							range: stm.getRange(),
							message: createTypeCannotBeAssignedToMessage(flags, type)
						});
					}
				}
			} else if (expectedType) {
				// TODO: Expect a return expression!
				this.verifyStatementExpression(stm);
			}
		} else {
			// TODO: Return not allowed here?
		}
		return undefined;
	}

	visitAssertStatement(stm: UCAssertStatement) {
		super.visitAssertStatement(stm);

		this.verifyStatementExpression(stm);
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, StaticBoolType)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
		return undefined;
	}

	visitExpression(expr: IExpression) {
		if (expr instanceof UCParenthesizedExpression) {
			expr.expression?.accept<any>(this);
		} else if (expr instanceof UCMetaClassExpression) {
			expr.expression?.accept<any>(this);
			expr.classRef?.accept<any>(this);
			// TODO: verify class type by inheritance
		} else if (expr instanceof UCCallExpression) {
			this.state.hasArguments = true;
			expr.expression.accept<any>(this);
			this.state.hasArguments = false;
			expr.arguments?.forEach(arg => arg.accept<any>(this));

			const type = expr.expression.getType();
			const symbol = type?.getRef();
			if (symbol instanceof UCMethodSymbol) {
				// FIXME: inferred type, this is unfortunately complicated :(
				this.checkArguments(symbol, expr);
			} else {
				// TODO: Validate if expressed symbol is callable,
				// i.e. either a 'Function/Delegate', 'Class', or a 'Struct' like Vector/Rotator.
			}
		} else if (expr instanceof UCElementAccessExpression) {
			if (expr.expression) {
				expr.expression.accept<any>(this);
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
				expr.argument.accept<any>(this);
				if (config.checkTypes) {
					const type = expr.argument.getType();
					if (!type || (type.getTypeFlags() & UCTypeFlags.NumberCoerce) === 0) {
						this.diagnostics.add({
							range: expr.argument.getRange(),
							message: {
								text: `Element access expression type is invalid.`,
								severity: DiagnosticSeverity.Error
							}
						});
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
			expr.left.accept<any>(this);
			this.resumeState();

			const memberContext = expr.left.getType()?.getRef() as UCStructSymbol;
			this.pushScope(memberContext);
			expr.member.accept<any>(this);
			this.popScope();
		} else if (expr instanceof UCConditionalExpression) {
			expr.condition.accept<any>(this);
			expr.true?.accept<any>(this);
			expr.false?.accept<any>(this);
		} else if (expr instanceof UCBaseOperatorExpression) {
			expr.expression.accept<any>(this);
			const operatorSymbol = expr.operator.getRef();
			if (!operatorSymbol) {
				this.diagnostics.add({
					range: expr.operator.getRange(),
					message: {
						text: `Invalid unary operator '{0}'.`,
						severity: DiagnosticSeverity.Error
					},
					args: [expr.operator.getName().toString()]
				});
			}
		} else if (expr instanceof UCBinaryOperatorExpression) {
			if (expr.left) {
				expr.left.accept<any>(this);

				const type = expr.left.getType();
				this.state.typeFlags = type?.getTypeFlags();
			} else {
				this.pushError(expr.getRange(), "Missing left expression!");
				return undefined;
			}
			if (expr.right) {
				expr.right.accept<any>(this);
			} else {
				this.pushError(expr.getRange(), "Missing right expression!");
				return undefined;
			}

			if (expr instanceof UCAssignmentExpression || expr instanceof UCAssignmentOperatorExpression) {
				// TODO: Validate type compatibility, but this requires us to match an overloaded operator first!
				const letType = expr.left!.getType();
				const letSymbol = letType?.getRef();
				if (letSymbol) {
					if (letSymbol instanceof UCPropertySymbol) {
						// Properties with a defined array dimension cannot be assigned!
						if (letSymbol.isFixedArray()) {
							this.diagnostics.add({
								range: letType!.getRange(),
								message: {
									text: `Cannot assign to '${letSymbol.getName()}' because it is a fixed array.`,
									severity: DiagnosticSeverity.Error
								}
							});
						}

						if (letSymbol.isConst()) {
							this.diagnostics.add({
								range: letType!.getRange(),
								message: {
									text: `Cannot assign to '${letSymbol.getName()}' because it is a constant.`,
									severity: DiagnosticSeverity.Error
								}
							});
						}
					} else if (letSymbol instanceof UCMethodSymbol && !(letSymbol instanceof UCDelegateSymbol)) {
						this.diagnostics.add({
							range: letType!.getRange(),
							message: {
								text: `Cannot assign to '${letSymbol.getName()}' because it is a function. Did you mean to assign a delegate?`,
								severity: DiagnosticSeverity.Error
							}
						});
						// TODO: Distinguish a delegate from a regular method!
						// TODO: throw error unless it's a delegate.
					}
				}
			} else if (expr instanceof UCDefaultAssignmentExpression) {
				if (config.checkTypes) {
					const letType = expr.left!.getType();
					if (letType && letType.getTypeFlags() === UCTypeFlags.Error) {
						this.pushError(
							expr.left!.getRange(),
							`Type of '${letType.getName()}' cannot be assigned a default value!`
						);
					}

					if (expr.right) {
						const leftType = expr.left!.getType();
						const rightType = expr.right.getType();
						if (rightType && leftType) {
							if (!typeMatchesFlags(rightType, leftType)) {
								this.pushError(
									expr.left!.getRange(),
									`Variable of type '${getTypeFlagsName(leftType)}' cannot be assigned to type '${getTypeFlagsName(rightType)}'`
								);
							}
						} else {
							// TODO: Invalid type?
						}

					} else {
						this.pushError(expr.getRange(), "Missing value!");
					}
				}
			}
		} else if (expr instanceof UCDefaultMemberCallExpression) {
			expr.propertyMember.accept<any>(this);
			expr.methodMember.accept<any>(this);
			expr.arguments?.forEach(arg => arg.accept<any>(this));

			const type = expr.methodMember.getType();
			const symbol = type?.getRef();
			if (symbol instanceof UCMethodSymbol) {
				this.checkArguments(symbol, expr, expr.getType());
			} else {
				this.pushError(expr.methodMember.getRange(), `Operation can only be applied to an array!`);
			}
		} else if (expr instanceof UCIdentifierLiteralExpression) {
			if (!this.context || !this.state.typeFlags) {
				return undefined;
			} else if ((this.state.typeFlags & UCTypeFlags.IdentifierTypes) === 0) {
				return undefined;
			}
			// We don't support objects, although this may be true in the check above due the fact that a class is also an Object.
			else if (this.state.typeFlags === UCTypeFlags.Object) {
				return undefined;
			}

			if (!expr.typeRef) {
				if (this.context) {
					this.diagnostics.add({
						range: expr.getRange(),
						message: {
							text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
							severity: DiagnosticSeverity.Error
						},
						args: [expr.id.name.toString(), this.context.getPath()]
					});
				} else {
					this.diagnostics.add({
						range: expr.getRange(),
						message: {
							text: diagnosticMessages.COULDNT_FIND_0.text,
							severity: DiagnosticSeverity.Error
						},
						args: [expr.id.name.toString()]
					});
				}
			}
		} else if (expr instanceof UCMemberExpression) {
			if (!expr.typeRef && this.context) {
				this.diagnostics.add({
					range: expr.getRange(),
					message: {
						text: diagnosticMessages.ID_0_DOES_NOT_EXIST_ON_TYPE_1.text,
						severity: DiagnosticSeverity.Error
					},
					args: [expr.id.name.toString(), this.context.getPath()]
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
					args: [expr.structTypeRef.getName().toString()]
				});
			}
		} else if (expr instanceof UCDefaultStructLiteral) {
			expr.arguments?.forEach(arg => arg?.accept<any>(this));
		} else if (expr instanceof UCObjectLiteral) {
			// TODO: verify class type by inheritance
			const castSymbol = expr.castRef.getRef();
			expr.castRef.accept<any>(this);

			if (expr.objectRef) {
				expr.objectRef.accept<any>(this);

				const objectSymbol = expr.objectRef.getRef();
				if (config.checkTypes && objectSymbol) {
					if (castSymbol === NativeClass && !(objectSymbol instanceof UCClassSymbol)) {
						this.pushError(expr.objectRef.id.range, `Type of '${objectSymbol.getPath()}' is not a class!`);
					} else if (castSymbol === NativeEnum && !(objectSymbol instanceof UCEnumSymbol)) {
						this.pushError(expr.objectRef.id.range, `Type of '${objectSymbol.getPath()}' is not an enum!`);
					}
				}
			}
		} else if (expr instanceof UCArrayCountExpression) {
			expr.argument?.accept<any>(this);
		} else if (expr instanceof UCArrayCountLiteral) {
			// TODO: Validate that referred property is a valid static array!
			expr.argumentRef?.accept<any>(this);
		} else if (expr instanceof UCNameOfLiteral) {
			expr.argumentRef?.accept<any>(this);
		} else if (expr instanceof UCSizeOfLiteral) {
			expr.argumentRef?.accept<any>(this);
		}
		return undefined;
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

			if (!param.isOptional()) {
				++passedArgumentsCount;
				if (arg instanceof UCEmptyArgument) {
					this.pushError(arg.getRange(),
						`An argument for non-optional parameter '${param.getName()}' is missing.`
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

			if (param.isOut()) {
				const argSymbol = arg.getType()?.getRef();
				// if (!argSymbol) {
				// 	this.pushError(
				// 		arg.getRange(),
				// 		`Non-resolved argument cannot be passed to an 'out' parameter.`)
				// 	);
				// } else
				if (argSymbol instanceof UCFieldSymbol) {
					if (argSymbol === LengthProperty) {
						this.pushError(arg.getRange(),
							`Cannot pass array property 'Length' to an 'out' parameter.`
						);
					}
					else if (argSymbol.isConst()) {
						this.pushError(arg.getRange(),
							`Argument '${argSymbol.getName()}' cannot be passed to an 'out' parameter, because it is a constant.`
						);
					}
				}
			}

			if (config.checkTypes) {
				const paramType = param.getType() ?? inferredType;
				// We'll play nice by not pushing any errors if the method's param has no found or defined type,
				// -- the 'type not found' error will suffice.
				if (paramType) {
					if (argType && !typeMatchesFlags(argType, paramType, param.isCoerced())) {
						const expectedFlags = paramType.getTypeFlags();
						this.pushError(arg.getRange(),
							`Argument of type '${getTypeFlagsName(argType)}' is not assignable to parameter of type '${UCTypeFlags[expectedFlags]}'.`
						);
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

function createExpectedTypeMessage(expected: UCTypeFlags, type?: ITypeSymbol): IDiagnosticMessage {
	return {
		text: `Expected type '${UCTypeFlags[expected]}', but got type '${type ? UCTypeFlags[type.getTypeFlags()] : UCTypeFlags.Error}'.`,
		severity: DiagnosticSeverity.Error
	};
}

function createTypeCannotBeAssignedToMessage(expected: UCTypeFlags, type?: ITypeSymbol): IDiagnosticMessage {
	return {
		text: `Type '${getTypeFlagsName(type)}' is not assignable to type '${UCTypeFlags[expected]}'.`,
		severity: DiagnosticSeverity.Error
	};
}