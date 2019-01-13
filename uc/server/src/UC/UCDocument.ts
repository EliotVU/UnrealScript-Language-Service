import { Position, Range } from 'vscode-languageserver-types';
import { Token, ANTLRErrorListener, RecognitionException, Recognizer } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { UCGrammarListener } from '../antlr/UCGrammarListener';
import { SyntaxErrorNode, IDiagnosticNode } from './diagnostics/diagnostics';
import { ISimpleSymbol } from './symbols/ISimpleSymbol';
import { ISymbolContainer } from './symbols/ISymbolContainer';
import { UCSymbol } from './symbols/UCSymbol';
import { UCClassSymbol, UCStructSymbol, UCConstSymbol, UCEnumSymbol, UCEnumMemberSymbol, UCScriptStructSymbol, UCTypeRef, UCPropertySymbol, UCFunctionSymbol, UCStateSymbol, UCObjectSymbol, UCDefaultVariableSymbol, UCSymbolRef, UCType, UCParamSymbol, UCLocalSymbol } from './symbols/symbols';
import { UCPackage } from "./symbols/UCPackage";
import * as UCParser from '../antlr/UCGrammarParser';

export function rangeFromToken(token: Token): Range {
	return {
		start: {
			line: token.line - 1,
			character: token.charPositionInLine
		},
		end: {
			line: token.line - 1,
			character: token.charPositionInLine + token.text.length
		}
	};
}

export function rangeFromTokens(startToken: Token, stopToken: Token): Range {
	return {
		start: {
			line: startToken.line - 1,
			character: startToken.charPositionInLine
		},
		end: {
			line: stopToken.line - 1,
			character: stopToken.charPositionInLine + stopToken.text.length
		}
	};
}

export class UCDocument implements UCGrammarListener, ANTLRErrorListener<Token> {
	public getDocument: (className: string) => UCDocument;

	public class?: UCClassSymbol;
	public nodes: IDiagnosticNode[] = [];
	private context: UCStructSymbol[] = []; // FIXME: Type

	constructor(public classPackage: UCPackage, public uri: string) {

	}

	push(newContext: UCStructSymbol) {
		this.context.push(newContext);
	}

	pop() {
		this.context.pop();
	}

	get(): ISymbolContainer<ISimpleSymbol> {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.classPackage;
	}

	declare(symbol: UCSymbol) {
		const context = this.get();
		context.add(symbol);
	}

	getSymbolAtPosition(position: Position): UCSymbol {
		return this.class.getSymbolAtPos(position);
	}

	syntaxError(_recognizer: Recognizer<Token, any>, offendingSymbol: Token | undefined, _line: number, _charPositionInLine: number, msg: string, _e: RecognitionException | undefined) {
		this.nodes.push(new SyntaxErrorNode(rangeFromToken(offendingSymbol), '(ANTLR Error) ' + msg));
	}

	visitErrorNode(errNode: ErrorNode) {
		// const node = new CodeErrorNode(errNode.symbol, errNode.text);
		// this.nodes.push(node);
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		const symbol = UCClassSymbol.visit(ctx);
		this.class = symbol;

		this.declare(symbol); // push to package
		this.push(symbol);
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const nameCtx = ctx.constName();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCConstSymbol(
			{ name: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);

		const valueCtx = ctx.constValue();
		if (valueCtx) {
			symbol.valueToken = valueCtx.start;
		}
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const nameCtx = ctx.enumName();
		if (!nameCtx) {
			return;
		}

		const { text: name, start: nameToken } = nameCtx;
		const symbol = new UCEnumSymbol(
			{ name, range: rangeFromToken(nameToken) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		for (const valueCtx of ctx.valueName()) {
			const member = new UCEnumMemberSymbol({
				name: valueCtx.text,
				range: rangeFromToken(valueCtx.start)
			});
			this.declare(member);
			// HACK: overwrite define() outer let.
			member.outer = symbol;
		}
		this.declare(symbol);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const nameCtx = ctx.structName();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCScriptStructSymbol(
			{ name: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		const extendsCtx = ctx.structReference();
		if (extendsCtx) {
			symbol.extendsRef = new UCTypeRef({
				name: extendsCtx.text,
				range: rangeFromTokens(extendsCtx.start, extendsCtx.stop)
			}, UCType.Struct);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.pop();
	}

	parseVariableType(varTypeCtx: UCParser.VariableTypeContext | UCParser.ArrayGenericContext) {
		var parseClassGeneric = (classGenericCtx: UCParser.ClassGenericContext) => {
			const className = classGenericCtx.classReference();
			return new UCTypeRef(
				{ name: className.text, range: rangeFromTokens(classGenericCtx.start, classGenericCtx.stop) },
			);
		};

		var typeName: string;
		const primitiveType = varTypeCtx.primitiveType();
		if (primitiveType) {
			typeName = primitiveType.text;
		} else {
			typeName = varTypeCtx.text;
		}

		let innerTypeRef: UCTypeRef;
		const classGenericCtx = varTypeCtx.classGeneric();
		if (classGenericCtx) {
			typeName = 'class';
			innerTypeRef = parseClassGeneric(classGenericCtx);
		} else if (varTypeCtx instanceof UCParser.VariableTypeContext) {
			const arrayGenericCtx = varTypeCtx.arrayGeneric();
			if (arrayGenericCtx) {
				typeName = 'array';
				innerTypeRef = this.parseInlinedDecl(arrayGenericCtx);
				if (!innerTypeRef) {
					innerTypeRef = this.parseVariableType(arrayGenericCtx);
				}
			}
		}

		const typeRef = new UCTypeRef(
			{ name: typeName, range: rangeFromTokens(varTypeCtx.start, varTypeCtx.stop) }
		);
		typeRef.InnerTypeRef = innerTypeRef;
		return typeRef;
	}

	parseInlinedDecl(propDeclType: UCParser.VariableDeclTypeContext | UCParser.ArrayGenericContext) {
		const inlinedStruct = propDeclType.structDecl();
		if (inlinedStruct) {
			const structName = inlinedStruct.structName();
			return new UCTypeRef(
				{ name: structName.text, range: rangeFromTokens(structName.start, structName.stop) },
				UCType.Struct
			);
		} else {
			const inlinedEnum = propDeclType.enumDecl();
			if (inlinedEnum) {
				const enumName = inlinedEnum.enumName();
				return new UCTypeRef(
					{ name: enumName.text, range: rangeFromTokens(enumName.start, enumName.stop) }
				);
			}
		}
		return undefined;
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const propDeclType = ctx.variableDeclType();
		if (!propDeclType) {
			return;
		}

		const varType = propDeclType.variableType();
		const typeRef = varType
			? this.parseVariableType(varType)
			: this.parseInlinedDecl(propDeclType);

		for (const varCtx of ctx.variable()) {
			const varName = varCtx.variableName();

			const symbol = new UCPropertySymbol(
				{ name: varName.start.text, range: rangeFromToken(varName.start) },

				// Stop at varCtx instead of ctx for mulitiple variable declarations.
				{ range: rangeFromTokens(ctx.start, varCtx.stop) }
			);
			symbol.typeRef = typeRef;
			this.declare(symbol);
		}
	}

	enterReplicationBlock(ctx: UCParser.ReplicationBlockContext) {
		const nameCtx = ctx.kwREPLICATION();
		const symbol = new UCStructSymbol(
			{ name: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.class.replicatedFieldRefs = [];
		this.declare(symbol);
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateId()) {
			const symbol = new UCSymbolRef({
				name: varCtx.text, range: rangeFromToken(varCtx.start)
			});

			this.class.replicatedFieldRefs.push(symbol);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const nameCtx = ctx.functionName();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCFunctionSymbol(
			// We need start and stop for functions with special symbols (which are made of multiple tokens)
			{ name: nameCtx.text, range: rangeFromTokens(nameCtx.start, nameCtx.stop) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		const returnTypeCtx = ctx.returnType();
		if (returnTypeCtx) {
			symbol.returnTypeRef = new UCTypeRef({
				name: returnTypeCtx.text,
				range: rangeFromTokens(returnTypeCtx.start, returnTypeCtx.stop)
			});
		}
		this.declare(symbol);
		this.push(symbol);

		if (!ctx.paramDecl()) {
			console.log('no params');
		}

		for (const paramCtx of ctx.paramDecl()) {
			if (!paramCtx) {
				break;
			}
			const varCtx = paramCtx.variable();
			const propName = varCtx.variableName();
			if (!propName) {
				continue;
			}
			const propSymbol = new UCParamSymbol(
				{ name: propName.text, range: rangeFromToken(propName.start) },
				{ range: rangeFromTokens(paramCtx.start, paramCtx.stop) }
			);

			const propTypeCtx = paramCtx.variableType();
			propSymbol.typeRef = new UCTypeRef({
				name: propTypeCtx.text,
				range: rangeFromTokens(propTypeCtx.start, propTypeCtx.stop)
			});
			symbol.params.push(propSymbol);
			this.declare(propSymbol);
		}

		for (const localCtx of ctx.localDecl()) {
			if (!localCtx) {
				break;
			}

			const propTypeCtx = localCtx.variableType();
			const propTypeRef = new UCTypeRef({
				name: propTypeCtx.text,
				range: rangeFromTokens(propTypeCtx.start, propTypeCtx.stop)
			});
			for (const varCtx of localCtx.variable()) {
				const propName = varCtx.variableName();
				if (!propName) {
					continue;
				}

				const propSymbol = new UCLocalSymbol(
					{ name: propName.text, range: rangeFromToken(propName.start) },
					// Stop at varCtx instead of localCtx for mulitiple variable declarations.
					{ range: rangeFromTokens(localCtx.start, varCtx.stop) }
				);
				propSymbol.typeRef = propTypeRef;
				this.declare(propSymbol);
			}
		}
		this.pop();
	}

	enterStateDecl(ctx: UCParser.StateDeclContext) {
		const stateName = ctx.stateName();
		if (!stateName) {
			return;
		}

		const symbol = new UCStateSymbol(
			{ name: stateName.text, range: rangeFromToken(stateName.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		const extendsCtx = ctx.stateReference();
		if (extendsCtx) {
			// FIXME: UCStateRef?
			symbol.extendsRef = new UCTypeRef({
				name: extendsCtx.text,
				range: rangeFromTokens(extendsCtx.start, extendsCtx.stop)
			}, UCType.State);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStateDecl(ctx: UCParser.StateDeclContext) {
		this.pop();
	}

	enterDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		const nameCtx = ctx.kwDEFAULTPROPERTIES();
		const symbol = new UCObjectSymbol(
			{ name: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);
		this.push(symbol);
	}

	enterObjectDecl(ctx: UCParser.ObjectDeclContext) {
		const idCtx = ctx.objectName();
		if (!idCtx[0]) {
			// TODO: throw error missing object name!
			return;
		}
		const symbol = new UCObjectSymbol(
			{ name: idCtx[0].text, range: rangeFromToken(idCtx[0].start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);
		this.push(symbol);
	}

	enterDefaultVariable(ctx: UCParser.DefaultVariableContext) {
		const idCtx = ctx.defaultId();
		const symbol = new UCDefaultVariableSymbol(
			{ name: idCtx.text, range: rangeFromToken(ctx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		symbol.varRef = new UCSymbolRef(
			{ name: idCtx.text, range: symbol.getIdRange() },
		);

		const valCtx = ctx.defaultValue();
		if (valCtx && valCtx.defaultLiteral().structLiteral()) {
			const structCtx = valCtx.defaultLiteral().structLiteral();
			const symbol = new UCObjectSymbol(
				// Use the same name as the assigned var's name.
				{ name: idCtx.text, range: rangeFromToken(structCtx.start) },
				{ range: rangeFromTokens(structCtx.start, structCtx.stop) }
			);
			this.push(symbol);
		}
		this.declare(symbol);
	}

	exitDefaultVariable(ctx: UCParser.DefaultVariableContext) {
		const valCtx = ctx.defaultValue();
		if (valCtx && valCtx.defaultLiteral().structLiteral()) {
			this.pop();
		}
	}

	exitObjectDecl(ctx: UCParser.ObjectDeclContext) {
		this.pop();
	}

	exitDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		this.pop();
	}
}