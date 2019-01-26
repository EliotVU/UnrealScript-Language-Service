import * as path from 'path';

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
	const start: Position = {
		line: token.line - 1,
		character: token.charPositionInLine
	};

	const end: Position = {
		line: token.line - 1,
		character: token.charPositionInLine + token.text.length
	};
	return { start, end };
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

export class UCDocumentListener implements UCGrammarListener, ANTLRErrorListener<Token> {
	public getDocument: (className: string, cb: (document: UCDocumentListener) => void) => void;

	public name: string;

	public class?: UCClassSymbol;
	private context: UCStructSymbol[] = []; // FIXME: Type

	public nodes: IDiagnosticNode[] = [];

	constructor(public classPackage: UCPackage, public uri: string) {
		this.name = path.basename(uri, '.uc');
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
		context.addSymbol(symbol);
	}

	link() {
		this.class!.link(this, this.class);
	}

	analyze() {
		this.class!.analyze(this, this.class);
	}

	syntaxError(_recognizer: Recognizer<Token, any>,
		offendingSymbol: Token | undefined,
		_line: number,
		_charPositionInLine: number,
		msg: string,
		_error: RecognitionException | undefined
	) {
		if (_error) {
			console.error(this.uri, _error.context ? _error.context.text : 'No context', _error.stack);
			this.nodes.push(new SyntaxErrorNode(rangeFromToken(offendingSymbol), '(Internal Error) ' + msg));
			return;
		}

		this.nodes.push(new SyntaxErrorNode(rangeFromToken(offendingSymbol), '(ANTLR Error) ' + msg));
	}

	visitErrorNode(errNode: ErrorNode) {
		// const node = new CodeErrorNode(errNode.symbol, errNode.text);
		// this.nodes.push(node);
	}

	visitExtendsClause(extendsCtx: UCParser.ExtendsClauseContext | UCParser.WithinClauseContext, type: UCType): UCTypeRef {
		var id = extendsCtx.qualifiedIdentifier();
		return new UCTypeRef({
			text: id.text,
			range: rangeFromTokens(id.start, id.stop)
		}, this.class, type);
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		var className = ctx.identifier();
		var classDecl = new UCClassSymbol(
			{ text: className.text, range: rangeFromToken(className.start)},
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.class = classDecl; // Important!, must be assigned before further parsing.

		var extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			classDecl.extendsRef = this.visitExtendsClause(extendsCtx, UCType.Class);
		}

		var withinCtx = ctx.withinClause();
		if (withinCtx) {
			classDecl.withinRef = this.visitExtendsClause(withinCtx, UCType.Class);
		}

		this.declare(classDecl); // push to package
		this.push(classDecl);
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const nameCtx = ctx.identifier();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCConstSymbol(
			{ text: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);

		const valueCtx = ctx.constValue();
		if (valueCtx) {
			symbol.valueToken = valueCtx.start;
		}
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const nameCtx = ctx.identifier();
		if (!nameCtx) {
			return;
		}

		const { text: name, start: nameToken } = nameCtx;
		const symbol = new UCEnumSymbol(
			{ text: name, range: rangeFromToken(nameToken) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		for (const memberCtx of ctx.enumMember()) {
			const member = new UCEnumMemberSymbol({
				text: memberCtx.identifier().text,
				range: rangeFromToken(memberCtx.start)
			});
			this.declare(member);
			// HACK: overwrite define() outer let.
			member.outer = symbol;
		}
		this.declare(symbol);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const nameCtx = ctx.identifier();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCScriptStructSymbol(
			{ text: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		const extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			symbol.extendsRef = this.visitExtendsClause(extendsCtx, UCType.Struct);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.pop();
	}

	private visitClassType(classTypeCtx: UCParser.ClassTypeContext) {
		const typeCtx = classTypeCtx.type();
		return new UCTypeRef(
			{ text: typeCtx.text, range: rangeFromTokens(typeCtx.start, typeCtx.stop) },
			undefined, UCType.Class
		);
	}

	private visitTypeDecl(varTypeCtx: UCParser.TypeDeclContext) {
		let typeText: string;
		let typeRange: Range;
		const type = varTypeCtx.type();
		if (type) {
			typeText = type.text;
			typeRange = rangeFromTokens(type.start, type.stop);
		} else {
			typeRange = rangeFromTokens(varTypeCtx.start, varTypeCtx.stop);
		}

		let innerTypeRef: UCTypeRef;
		const classTypeCtx = varTypeCtx.classType();
		if (classTypeCtx) {
			innerTypeRef = this.visitClassType(classTypeCtx);
			typeText = 'class';
			typeRange.end.character = typeRange.start.character + 5;
		} else if (varTypeCtx instanceof UCParser.TypeDeclContext) {
			const arrayTypeCtx = varTypeCtx.arrayType();
			if (arrayTypeCtx) {
				innerTypeRef = this.visitInlinedDeclTypes(arrayTypeCtx.inlinedDeclTypes());
				typeText = 'array';
				typeRange.end.character = typeRange.start.character + 5;
			}
		}

		const typeRef = new UCTypeRef(
			{ text: typeText, range: typeRange },
			this.get() as UCStructSymbol
		);

		typeRef.InnerTypeRef = innerTypeRef;
		if (innerTypeRef) {
			innerTypeRef.outer = typeRef;
		}
		return typeRef;
	}

	private visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext) {
		const inlinedStruct = inlinedTypeCtx.structDecl();
		if (inlinedStruct) {
			const structName = inlinedStruct.identifier();
			return new UCTypeRef(
				{ text: structName.text, range: rangeFromTokens(structName.start, structName.stop) },
				undefined, UCType.Struct
			);
		}

		const inlinedEnum = inlinedTypeCtx.enumDecl();
		if (inlinedEnum) {
			const enumName = inlinedEnum.identifier();
			return new UCTypeRef(
				{ text: enumName.text, range: rangeFromTokens(enumName.start, enumName.stop) },
				undefined, UCType.Enum
			);
		}
		return this.visitTypeDecl(inlinedTypeCtx.typeDecl());
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const varDeclType = ctx.inlinedDeclTypes();
		if (!varDeclType) {
			return;
		}

		const typeRef = this.visitInlinedDeclTypes(varDeclType);

		for (const varCtx of ctx.variable()) {
			const varName = varCtx.identifier();

			const symbol = new UCPropertySymbol(
				{ text: varName.start.text, range: rangeFromToken(varName.start) },

				// Stop at varCtx instead of ctx for mulitiple variable declarations.
				{ range: rangeFromTokens(ctx.start, varCtx.stop) }
			);
			symbol.typeRef = typeRef;
			this.declare(symbol);

			if (typeRef) {
				typeRef.outer = symbol.outer; // FIXME: Assign to current context instead.
			}
		}
	}

	enterReplicationBlock(ctx: UCParser.ReplicationBlockContext) {
		const nameCtx = ctx.kwREPLICATION();
		const symbol = new UCStructSymbol(
			{ text: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.class.replicatedFieldRefs = [];
		this.declare(symbol);
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateId()) {
			const symbol = new UCSymbolRef(
				{text: varCtx.text, range: rangeFromToken(varCtx.start)},
				this.class
			);
			this.class.replicatedFieldRefs.push(symbol);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const nameCtx = ctx.functionName();
		if (!nameCtx) {
			return;
		}

		const funcSymbol = new UCFunctionSymbol(
			// We need start and stop for functions with special symbols (which are made of multiple tokens)
			{ text: nameCtx.text, range: rangeFromTokens(nameCtx.start, nameCtx.stop) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		const returnTypeCtx = ctx.returnType();
		if (returnTypeCtx) {
			funcSymbol.returnTypeRef = new UCTypeRef({
				text: returnTypeCtx.text,
				range: rangeFromTokens(returnTypeCtx.start, returnTypeCtx.stop)
			}, funcSymbol);
		}
		this.declare(funcSymbol);
		this.push(funcSymbol);

		const params = ctx.parameters();
		if (params) {
			for (const paramCtx of params.paramDecl()) {
				if (!paramCtx) {
					break;
				}
				const varCtx = paramCtx.variable();
				const propName = varCtx.identifier();
				if (!propName) {
					continue;
				}
				const propSymbol = new UCParamSymbol(
					{ text: propName.text, range: rangeFromToken(propName.start) },
					{ range: rangeFromTokens(paramCtx.start, paramCtx.stop) }
				);

				const propTypeCtx = paramCtx.typeDecl();
				propSymbol.typeRef = new UCTypeRef({
					text: propTypeCtx.text,
					range: rangeFromTokens(propTypeCtx.start, propTypeCtx.stop)
				}, funcSymbol);
				funcSymbol.params.push(propSymbol);
				this.declare(propSymbol);
			}
		}

		const body = ctx.functionBody();
		if (body) {
			for (const localCtx of body.localDecl()) {
				if (!localCtx) {
					break;
				}

				const propTypeCtx = localCtx.typeDecl();
				const propTypeRef = new UCTypeRef({
					text: propTypeCtx.text,
					range: rangeFromTokens(propTypeCtx.start, propTypeCtx.stop)
				}, funcSymbol);
				for (const varCtx of localCtx.variable()) {
					const propName = varCtx.identifier();
					if (!propName) {
						continue;
					}

					const propSymbol = new UCLocalSymbol(
						{ text: propName.text, range: rangeFromToken(propName.start) },
						// Stop at varCtx instead of localCtx for mulitiple variable declarations.
						{ range: rangeFromTokens(localCtx.start, varCtx.stop) }
					);
					propSymbol.typeRef = propTypeRef;
					this.declare(propSymbol);
				}
			}
		}
		this.pop();
	}

	enterStateDecl(ctx: UCParser.StateDeclContext) {
		const stateName = ctx.identifier();
		if (!stateName) {
			return;
		}

		const symbol = new UCStateSymbol(
			{ text: stateName.text, range: rangeFromToken(stateName.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		const extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			symbol.extendsRef = this.visitExtendsClause(extendsCtx, UCType.State);
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
			{ text: nameCtx.text, range: rangeFromToken(nameCtx.start) },
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
			{ text: idCtx[0].text, range: rangeFromToken(idCtx[0].start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);
		this.push(symbol);
	}

	enterDefaultVariable(ctx: UCParser.DefaultVariableContext) {
		const idCtx = ctx.defaultId();
		const symbol = new UCDefaultVariableSymbol(
			{ text: idCtx.text, range: rangeFromToken(ctx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		symbol.varRef = new UCSymbolRef(
			{ text: idCtx.text, range: symbol.getIdRange() },
			symbol
		);

		this.declare(symbol);

		const valCtx = ctx.defaultValue();
		if (valCtx) {
			const literal = valCtx.defaultLiteral();
			const structCtx = literal.structLiteral();
			if (structCtx) {
				const subSymbol = new UCObjectSymbol(
					// Use the same name as the assigned var's name.
					{ text: idCtx.text, range: rangeFromToken(structCtx.start) },
					{ range: rangeFromTokens(structCtx.start, structCtx.stop) }
				);
				this.push(subSymbol);
			}
		}
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