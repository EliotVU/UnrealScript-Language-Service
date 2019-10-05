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
	PredefinedBool, NativeArray,
	UCReplicationBlock, UCDefaultPropertiesBlock, UCObjectSymbol,
} from '../Symbols';

import { UCDocument } from '../document';
import { toHash, NAME_STRUCT, NAME_STATE, NAME_DELEGATE } from '../names';
import { config, UCGeneration } from '../indexer';

import { DiagnosticCollection } from './diagnostic';

import * as diagnosticMessages from './diagnosticMessages.json';

export class DocumentAnalyzer extends DefaultSymbolWalker {
	private context: UCStructSymbol | undefined;

	constructor(private document: UCDocument, private diagnostics: DiagnosticCollection) {
		super();

		if (document.class) {
			this.context = document.class;
			this.context.accept(this);
		}
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

	visitStructBase(symbol: UCStructSymbol) {
		super.visitStructBase(symbol);
		if (symbol.block) {
			symbol.block.analyze(this.document, symbol);
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
		super.visitConst(symbol);

		if (symbol.expression) {
			symbol.expression.analyze(this.document, this.context);
		}
		return symbol;
	}

	visitEnum(symbol: UCEnumSymbol) {
		// Do nothing, we don't have any useful analytics for enum declarations yet!
		return symbol;
	}

	visitScriptStruct(symbol: UCScriptStructSymbol) {
		super.visitScriptStruct(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getReference();
			if (referredSymbol && referredSymbol.getKind() !== SymbolKind.Struct) {
				this.diagnostics.add({
					range: symbol.extendsType.id.range,
					message: diagnosticMessages.TYPE_0_CANNOT_EXTEND_TYPE_OF_1,
					args: [NAME_STRUCT.toString(), referredSymbol.getQualifiedName()]
				});
			}
		}
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

			if (config.checkTypes && symbol.type) {
				const referredSymbol = symbol.type.getReference();
				if (referredSymbol === PredefinedBool || referredSymbol === NativeArray) {
					this.diagnostics.add({
						range: symbol.type.id.range,
						message: {
							text: `Illegal array type '${symbol.type.getTypeText()}'`,
							severity: DiagnosticSeverity.Error
						}
					});
				}
			}
		}

		if (symbol.isDynamicArray()) {
			// TODO: check valid types, and also check if we are a static array!
			// TODO: Should define a custom type class for arrays, so that we can analyze it right there.
		}

		return symbol;
	}

	visitMethod(symbol: UCMethodSymbol) {
		super.visitMethod(symbol);

		if (symbol.params) {
			for (var requiredParamsCount = 0; requiredParamsCount < symbol.params.length; ++ requiredParamsCount) {
				if (symbol.params[requiredParamsCount].isOptional()) {
					// All trailing params after the first optional param, are required to be declared as 'optional' too.
					for (let i = requiredParamsCount + 1; i < symbol.params.length; ++ i) {
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
		return symbol;
	}

	visitState(symbol: UCStateSymbol) {
		super.visitState(symbol);

		if (config.checkTypes && symbol.extendsType) {
			const referredSymbol = symbol.extendsType.getReference();
			if (referredSymbol && !(referredSymbol instanceof UCStateSymbol)) {
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
		return symbol;
	}

	visitParameter(symbol: UCParamSymbol) {
		super.visitParameter(symbol);

		if (symbol.defaultExpression) {
			// TODO: Expression walker...
			symbol.defaultExpression.analyze(this.document, this.context);

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

			if (symbol instanceof UCPropertySymbol || symbol instanceof UCMethodSymbol) {
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
		return symbol;
	}

	visitObjectSymbol(symbol: UCObjectSymbol) {
		if (symbol.classType) {
			symbol.classType.accept(this);
		}
		if (symbol.block) {
			symbol.block.analyze(this.document, symbol.super || symbol);
		}
		return super.visitStructBase(symbol);
	}
}