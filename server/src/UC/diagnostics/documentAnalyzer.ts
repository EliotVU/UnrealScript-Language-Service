import { DiagnosticSeverity, SymbolKind } from 'vscode-languageserver';

import { DefaultSymbolWalker } from '../symbolWalker';
import {
	UCStructSymbol, UCClassSymbol,
	UCParamSymbol, UCConstSymbol,
	UCEnumSymbol, UCObjectTypeSymbol,
	UCScriptStructSymbol, UCStateSymbol,
	UCArrayTypeSymbol, UCDelegateTypeSymbol,
	UCDelegateSymbol, UCPropertySymbol,
	UCMethodSymbol, UCBinaryOperatorSymbol,
	UCReplicationBlock, UCObjectSymbol, UCTypeFlags,
	typeMatchesFlags, ITypeSymbol, getTypeFlagsName,
} from '../Symbols';
import {
	UCBlock, IStatement,
	UCExpressionStatement,
	UCThenStatement, UCIfStatement, UCDoUntilStatement,
	UCForStatement, UCWhileStatement, UCReturnStatement,
	UCAssertStatement,
	UCSwitchStatement,
	UCForEachStatement
} from '../statements';
import { IExpression } from '../expressions';

import { UCDocument } from '../document';
import { toHash, NAME_STRUCT, NAME_STATE, NAME_DELEGATE } from '../names';
import { config, UCGeneration } from '../indexer';

import { DiagnosticCollection } from './diagnostic';

import * as diagnosticMessages from './diagnosticMessages.json';

export class DocumentAnalyzer extends DefaultSymbolWalker {
	private scopes: UCStructSymbol[] = [];
	private context?: UCStructSymbol;

	constructor(private document: UCDocument, private diagnostics: DiagnosticCollection) {
		super();

		if (document.class) {
			this.push(document.class);
			document.class.accept<any>(this);
		}
	}

	push(context?: UCStructSymbol) {
		this.context = context;
		if (context) {
			this.scopes.push(context);
		}
	}

	pop(): UCStructSymbol | undefined {
		this.scopes.pop();
		this.context = this.scopes[this.scopes.length - 1];
		return this.context;
	}

	visitObjectType(symbol: UCObjectTypeSymbol) {
		super.visitObjectType(symbol);

		const referredSymbol = symbol.getReference();
		if (config.checkTypes && !referredSymbol) {
			this.diagnostics.add({
				range: symbol.id.range,
				message: diagnosticMessages.TYPE_0_NOT_FOUND,
				args: [symbol.getId().toString()]
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
			const referredSymbol = symbol.baseType.getReference();
			if (referredSymbol && !(referredSymbol instanceof UCDelegateSymbol)) {
				this.diagnostics.add({
					range: symbol.baseType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_DELEGATE.toString(), referredSymbol.getQualifiedName()]
				});
			}
		}
		return symbol;
	}

	visitClass(symbol: UCClassSymbol) {
		super.visitClass(symbol);

		const className = symbol.getId();
		if (className.hash !== toHash(this.document.fileName)) {
			this.diagnostics.add({
				range: symbol.id.range,
				message: diagnosticMessages.CLASS_NAME_0_MUST_MATCH_DOCUMENT_NAME_1,
				args: [className.toString(), this.document.fileName]
			});
		}
		return symbol;
	}

	visitConst(symbol: UCConstSymbol) {
		this.push(this.document.class);
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
		this.pop();
		return symbol;
	}

	visitEnum(symbol: UCEnumSymbol) {
		// Do nothing, we don't have any useful analytics for enum declarations yet!
		return symbol;
	}

	visitScriptStruct(symbol: UCScriptStructSymbol) {
		this.push(symbol);
		super.visitScriptStruct(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getReference();
			if (referredSymbol && referredSymbol.getTypeFlags() !== UCTypeFlags.Struct) {
				this.diagnostics.add({
					range: symbol.extendsType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_STRUCT.toString(), referredSymbol.getQualifiedName()]
				});
			}
		}
		this.pop();
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
		this.push(symbol);
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
								text: `Parameter '${param.getId()}' must be marked 'optional' after an optional parameter.`,
								severity: DiagnosticSeverity.Error
							}
						});
					}
					break;
				}
			}
			symbol.requiredParamsCount = requiredParamsCount;
		}

		if (symbol.getKind() === SymbolKind.Operator) {
			if (!symbol.isFinal()) {
				this.diagnostics.add({
					range: symbol.id.range,
					message: {
						text: `Operator must be declared as 'final'.`,
						severity: DiagnosticSeverity.Error
					}
				});
			}

			if (symbol instanceof UCBinaryOperatorSymbol) {
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
		this.pop();
		return symbol;
	}

	visitState(symbol: UCStateSymbol) {
		this.push(symbol);
		super.visitState(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getReference();
			if (referredSymbol && referredSymbol.getTypeFlags() !== UCTypeFlags.State) {
				this.diagnostics.add({
					range: symbol.extendsType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_STATE.toString(), referredSymbol.getQualifiedName()]
				});
			}
		}

		if (symbol.ignoreRefs) for (const ref of symbol.ignoreRefs) {
			// TODO: How does uscript behave when an operator is referred?
			const referredSymbol = ref.getReference();
			if (!referredSymbol) {
				this.diagnostics.add({
					range: ref.id.range,
					message: diagnosticMessages.COULDNT_FIND_0,
					args: [ref.getId().toString()]
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
						text: `'${referredSymbol.getId()}' is not a function.`,
						severity: DiagnosticSeverity.Error
					}
				});
			}
		}
		this.pop();
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
							text: `To assign a default value to a parameter, it must be marked as 'optional'!`,
							severity: DiagnosticSeverity.Error
						}
					});
				}
			} else {
				this.diagnostics.add({
					range: symbol.id.range,
					message: {
						text: `Assigning a default value to a parameter, is only available as of UC3+!`,
						severity: DiagnosticSeverity.Error
					},
				});
			}
		}
		return symbol;
	}

	visitReplicationBlock(symbol: UCReplicationBlock) {
		this.push(this.document.class || symbol);
		super.visitReplicationBlock(symbol);

		for (let symbolRef of symbol.symbolRefs.values()) {
			const symbol = symbolRef.getReference();
			if (!symbol) {
				this.diagnostics.add({
					range: symbolRef.id.range,
					message: {
						text: `Variable '${symbolRef.getId()}' not found!`,
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
							text: `Variable or Function '${symbol.getQualifiedName()}' needs to be declared in class '${this.document.class!.getQualifiedName()}'!`,
							severity: DiagnosticSeverity.Error
						}
					});
				}
			} else {
				this.diagnostics.add({
					range: symbolRef.id.range,
					message: {
						text: `Type of '${symbol.getId()}' is neither a variable nor function!`,
						severity: DiagnosticSeverity.Error
					}
				});
			}
		}
		this.pop();
		return symbol;
	}

	visitObjectSymbol(symbol: UCObjectSymbol) {
		this.push(symbol.super || symbol);
		super.visitStructBase(symbol);
		symbol.classType?.accept<any>(this);
		this.pop();
		return symbol;
	}

	visitBlock(symbol: UCBlock) {
		for (let statement of symbol.statements) if (statement) {
			try {
				statement.accept<any>(this);
			} catch (err) {
				console.error('Hit a roadblock while analyzing a statement', this.context ? this.context.getQualifiedName() : '???', err);
			}
		}
		return symbol;
	}

	visitStatement(stm: IStatement) {
		// TODO: Report statements which are missing an expression.
		if (stm instanceof UCExpressionStatement) {
			stm.expression?.accept<any>(this);
			if (stm instanceof UCThenStatement) {
				stm.then?.accept<any>(this);
				if (stm instanceof UCIfStatement) {
					this.visitIfStatement(stm);
					stm.else?.accept<any>(this);
				} else if (stm instanceof UCWhileStatement) {
					this.visitWhileStatement(stm);
				} else if (stm instanceof UCDoUntilStatement) {
					this.visitDoUntilStatement(stm);
				} else if (stm instanceof UCForStatement) {
					this.visitForStatement(stm);
					stm.init?.accept<any>(this);
					stm.next?.accept<any>(this);
				} else if (stm instanceof UCForEachStatement) {
					// TODO: Verify we have an iterator function or array(UC3+).
				} else if (stm instanceof UCSwitchStatement) {
				}
			} else if (stm instanceof UCReturnStatement) {
				this.visitReturnStatement(stm);
			} else if (stm instanceof UCAssertStatement) {
				this.visitAssertStatement(stm);
			}
		}
		return stm;
	}

	visitIfStatement(stm: UCIfStatement) {
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, UCTypeFlags.Bool)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
	}

	visitWhileStatement(stm: UCWhileStatement) {
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, UCTypeFlags.Bool)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
	}

	visitDoUntilStatement(stm: UCDoUntilStatement) {
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, UCTypeFlags.Bool)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
	}

	visitForStatement(stm: UCForStatement) {
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, UCTypeFlags.Bool)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
	}

	visitReturnStatement(stm: UCReturnStatement) {
		if (!config.checkTypes) return stm;

		if (this.context instanceof UCMethodSymbol) {
			const expectedType = this.context.getType();
			if (stm.expression) {
				const type = stm.expression.getType();
				if (!expectedType) {
					// TODO: No return expression expected!
				} else {
					const flags = expectedType.getTypeFlags();
					if (!typeMatchesFlags(type, flags)) {
						this.diagnostics.add({
							range: stm.getRange(),
							message: createTypeCannotBeAssignedToMessage(flags, type)
						});
					}
				}
			} else if (expectedType) {
				// TODO: Expect a return expression!
			}
		} else {
			// TODO: Return not allowed here?
		}
	}

	visitAssertStatement(stm: UCAssertStatement) {
		if (stm.expression && config.checkTypes) {
			const type = stm.expression.getType();
			if (!typeMatchesFlags(type, UCTypeFlags.Bool)) {
				this.diagnostics.add({
					range: stm.getRange(),
					message: createExpectedTypeMessage(UCTypeFlags.Bool, type)
				});
			}
		}
	}

	visitExpression(expr: IExpression) {
		expr.analyze(this.document, this.context);
		return expr;
	}
}

function createExpectedTypeMessage(expected: UCTypeFlags, type?: ITypeSymbol) {
	return {
		text: `Expected type '${UCTypeFlags[expected]}', but got type '${type ? UCTypeFlags[type.getTypeFlags()] : UCTypeFlags.Error}'.`,
		severity: DiagnosticSeverity.Error
	};
}

function createTypeCannotBeAssignedToMessage(expected: UCTypeFlags, type?: ITypeSymbol) {
	return {
		text: `Type '${getTypeFlagsName(type)}' is not assignable to type '${UCTypeFlags[expected]}'.`,
		severity: DiagnosticSeverity.Error
	};
}