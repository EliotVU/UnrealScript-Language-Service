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
	var start: Position = {
		line: token.line - 1,
		character: token.charPositionInLine
	};

	return {
		start,
		end: start
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

export function visitExtendsClause(extendsCtx: UCParser.ExtendsClauseContext | UCParser.WithinClauseContext, type: UCType): UCTypeRef {
	var id = extendsCtx.qualifiedIdentifier();
	return new UCTypeRef({
		text: id.text,
		range: rangeFromTokens(id.start, id.stop)
	}, undefined, type);
}

export class UCDocument implements UCGrammarListener, ANTLRErrorListener<Token> {
	public getDocument: (className: string, cb: (document: UCDocument) => void) => void;

	public name: string;

	public class?: UCClassSymbol;
	private context: UCStructSymbol[] = []; // FIXME: Type

	public hasBeenLinked: boolean = false;
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
		context.add(symbol);
	}

	getSymbolAtPosition(position: Position): UCSymbol {
		return this.class.getSymbolAtPos(position);
	}

	link(classDocument: UCDocument): any {
		if (this.hasBeenLinked) {
			return;
		}

		this.class.link(classDocument);
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

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		var className = ctx.identifier();
		var classDecl = new UCClassSymbol(
			{ text: className.text, range: rangeFromToken(className.start)},
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		var extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			classDecl.extendsRef = visitExtendsClause(extendsCtx, UCType.Class);
		}

		var withinCtx = ctx.withinClause();
		if (withinCtx) {
			classDecl.withinRef = visitExtendsClause(withinCtx, UCType.Class);
		}
		this.class = classDecl;

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
			symbol.extendsRef = visitExtendsClause(extendsCtx, UCType.Struct);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.pop();
	}

	private visitClassType(classTypeCtx: UCParser.ClassTypeContext) {
		const className: string = classTypeCtx.type().text;
		return new UCTypeRef(
			{ text: className, range: rangeFromTokens(classTypeCtx.start, classTypeCtx.stop) },
			undefined
		);
	}

	private visitTypeDecl(varTypeCtx: UCParser.TypeDeclContext) {
		var typeName: string;
		const type = varTypeCtx.type();
		if (type) {
			typeName = type.text;
		}

		let innerTypeRef: UCTypeRef;
		const classTypeCtx = varTypeCtx.classType();
		if (classTypeCtx) {
			typeName = 'class';
			innerTypeRef = this.visitClassType(classTypeCtx);
		} else if (varTypeCtx instanceof UCParser.TypeDeclContext) {
			const arrayTypeCtx = varTypeCtx.arrayType();
			if (arrayTypeCtx) {
				typeName = 'array';
				innerTypeRef = this.visitInlinedDeclTypes(arrayTypeCtx.inlinedDeclTypes());
			}
		}

		const typeRef = new UCTypeRef(
			{ text: typeName, range: rangeFromTokens(varTypeCtx.start, varTypeCtx.stop) },
			undefined
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
				undefined
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

		const symbol = new UCFunctionSymbol(
			// We need start and stop for functions with special symbols (which are made of multiple tokens)
			{ text: nameCtx.text, range: rangeFromTokens(nameCtx.start, nameCtx.stop) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		const returnTypeCtx = ctx.returnType();
		if (returnTypeCtx) {
			symbol.returnTypeRef = new UCTypeRef({
				text: returnTypeCtx.text,
				range: rangeFromTokens(returnTypeCtx.start, returnTypeCtx.stop)
			}, symbol);
		}
		this.declare(symbol);
		this.push(symbol);

		var params = ctx.parameters();
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
				}, symbol);
				symbol.params.push(propSymbol);
				this.declare(propSymbol);
			}
		}

		var body = ctx.functionBody();
		if (body) {
			for (const localCtx of body.localDecl()) {
				if (!localCtx) {
					break;
				}

				const propTypeCtx = localCtx.typeDecl();
				const propTypeRef = new UCTypeRef({
					text: propTypeCtx.text,
					range: rangeFromTokens(propTypeCtx.start, propTypeCtx.stop)
				}, symbol);
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
			symbol.extendsRef = visitExtendsClause(extendsCtx, UCType.State);
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