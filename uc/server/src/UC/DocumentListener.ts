import * as fs from 'fs';
import * as path from 'path';

import { Diagnostic, Position, Range } from 'vscode-languageserver-types';
import URI from 'vscode-uri';

import { BehaviorSubject } from 'rxjs';

import { ANTLRErrorListener, RecognitionException, Recognizer, Token, CommonTokenStream } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';

import { UCGrammarListener } from '../antlr/UCGrammarListener';
import * as UCParser from '../antlr/UCGrammarParser';

import { DocumentParser } from './DocumentParser';
import { ISymbol } from './symbols/ISymbol';
import { ISymbolContainer } from './symbols/ISymbolContainer';
import {
	UCClassSymbol, UCConstSymbol, UCDefaultPropertiesSymbol,
	UCEnumMemberSymbol, UCEnumSymbol, UCMethodSymbol,
	UCLocalSymbol, UCObjectSymbol, UCPackage, UCParamSymbol,
	UCPropertySymbol, UCScriptStructSymbol, UCStateSymbol,
	UCStructSymbol, UCSymbol, UCReferenceSymbol,
	UCTypeSymbol,
	CORE_PACKAGE
} from './symbols';
import { UCTypeKind } from './symbols/UCTypeKind';
import { IDiagnosticNode, SyntaxErrorNode } from './diagnostics/diagnostics';

function rangeFromBound(token: Token): Range {
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

function rangeFromBounds(startToken: Token, stopToken: Token): Range {
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
	private context?: UCStructSymbol[]; // FIXME: Type

	public nodes: IDiagnosticNode[] = [];
	public tokenStream: CommonTokenStream;

	constructor(public classPackage: UCPackage, public readonly uri: string) {
		this.name = path.basename(uri, '.uc');
	}

	push(newContext: UCStructSymbol) {
		this.context.push(newContext);
	}

	pop() {
		this.context.pop();
	}

	get(): ISymbolContainer<ISymbol> {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.classPackage;
	}

	declare(symbol: UCSymbol) {
		const context = this.get();
		context.addSymbol(symbol);
	}

	parse(text: string) {
		const parser = new DocumentParser(text);
		parser.parse(this);

		this.tokenStream = parser.tokenStream;
	}

	readText(): string {
		const filePath = URI.parse(this.uri).fsPath;
		const text = fs.readFileSync(filePath).toString();
		return text;
	}

	link() {
		this.class!.link(this, this.class);
	}

	invalidate() {
		this.class = undefined;
	}

	analyze(): Diagnostic[] {
		this.nodes = []; // clear
		this.class!.analyze(this, this.class);

		return this.nodes
			.map(node => {
				return Diagnostic.create(
					node.getRange(),
					node.toString(),
					undefined,
					undefined,
					'unrealscript'
				);
			});
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
			this.nodes.push(new SyntaxErrorNode(rangeFromBound(offendingSymbol), '(Internal Error) ' + msg));
			return;
		}

		this.nodes.push(new SyntaxErrorNode(rangeFromBound(offendingSymbol), '(ANTLR Syntax Error) ' + msg));
	}

	visitErrorNode(errNode: ErrorNode) {
		const node = new SyntaxErrorNode(rangeFromBound(errNode.symbol), '(ANTLR Node Error) ' + errNode.text);
		this.nodes.push(node);
	}

	visitExtendsClause(extendsCtx: UCParser.ExtendsClauseContext | UCParser.WithinClauseContext, type: UCTypeKind): UCTypeSymbol {
		const id = extendsCtx.qualifiedIdentifier();
		return new UCTypeSymbol({
			name: id.text,
			range: rangeFromBounds(id.start, id.stop)
		}, type);
	}

	enterProgram(ctx: UCParser.ProgramContext) {
		this.context = [];
	}

	exitProgram(ctx: UCParser.ProgramContext) {
		this.context = undefined;
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		const className = ctx.identifier();
		const classDecl = new UCClassSymbol(
			{ name: className.text, range: rangeFromBound(className.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		classDecl.context = ctx;
		this.class = classDecl; // Important!, must be assigned before further parsing.

		const extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			classDecl.extendsType = this.visitExtendsClause(extendsCtx, UCTypeKind.Class);
			classDecl.extendsType.outer = classDecl;
		}

		const withinCtx = ctx.withinClause();
		if (withinCtx) {
			classDecl.withinType = this.visitExtendsClause(withinCtx, UCTypeKind.Class);
			classDecl.withinType.outer = classDecl;
		}

		const modifiers = ctx.classModifier();
		for (let modifier of modifiers) {
			const name = modifier.identifier();
			const modifierArguments = modifier.modifierArguments();
			switch (name.text.toLowerCase()) {
				case 'dependson': {
					if (modifierArguments) {
						if (!classDecl.dependsOnTypes) {
							classDecl.dependsOnTypes = [];
						}
						for (let type of modifierArguments.modifierValue()) {
							classDecl.dependsOnTypes.push(new UCTypeSymbol(
								{ name: type.text, range: rangeFromBounds(type.start, type.stop) },
								UCTypeKind.Class
							));
						}
					}
				}
				case 'implements': {
					if (modifierArguments) {
						if (!classDecl.implementsTypes) {
							classDecl.implementsTypes = [];
						}
						for (let type of modifierArguments.modifierValue()) {
							classDecl.implementsTypes.push(new UCTypeSymbol(
								{ name: type.text, range: rangeFromBounds(type.start, type.stop) },
								UCTypeKind.Class
							));
						}
					}
				}
			}
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
			{ name: nameCtx.text, range: rangeFromBound(nameCtx.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;
		this.declare(symbol);

		const valueCtx = ctx.constValue();
		if (valueCtx) {
			symbol.value = valueCtx.text;
		}
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const nameCtx = ctx.identifier();
		if (!nameCtx) {
			return;
		}

		const { text: name, start: nameToken } = nameCtx;
		const symbol = new UCEnumSymbol(
			{ name: name, range: rangeFromBound(nameToken) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;
		this.declare(symbol);
		this.push(symbol);

		var count = 0;
		for (const memberCtx of ctx.enumMember()) {
			const member = new UCEnumMemberSymbol({
				name: memberCtx.identifier().text,
				range: rangeFromBound(memberCtx.start)
			}, { range: rangeFromBound(memberCtx.start) });
			this.declare(member);
			// HACK: overwrite define() outer let.
			member.outer = symbol;
			member.value = count ++;
		}
	}

	exitEnumDecl(ctx: UCParser.EnumDeclContext) {
		this.pop();
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const nameCtx = ctx.identifier();
		if (!nameCtx) {
			return;
		}

		const symbol = new UCScriptStructSymbol(
			{ name: nameCtx.text, range: rangeFromBound(nameCtx.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;

		const extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			symbol.extendsType = this.visitExtendsClause(extendsCtx, UCTypeKind.Struct);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.pop();
	}

	private visitClassType(classTypeCtx: UCParser.ClassTypeContext): UCTypeSymbol {
		const typeCtx = classTypeCtx.type();
		return new UCTypeSymbol(
			{ name: typeCtx.text, range: rangeFromBounds(typeCtx.start, typeCtx.stop) },
			UCTypeKind.Class
		);
	}

	private visitTypeDecl(varTypeCtx: UCParser.TypeDeclContext): UCTypeSymbol {
		let typeIdText: string;
		let typeIdRange: Range;
		let innerTypeSymbol: UCTypeSymbol;

		const typeCtx = varTypeCtx.type();
		if (typeCtx) {
			typeIdText = typeCtx.text;
			typeIdRange = rangeFromBounds(typeCtx.start, typeCtx.stop);
		} else {
			const classTypeCtx = varTypeCtx.classType();
			if (classTypeCtx) {
				innerTypeSymbol = this.visitClassType(classTypeCtx);
				typeIdText = 'Class';
				typeIdRange = rangeFromBound(classTypeCtx.start);
			} else if (varTypeCtx instanceof UCParser.TypeDeclContext) {
				const arrayTypeCtx = varTypeCtx.arrayType();
				if (arrayTypeCtx) {
					innerTypeSymbol = this.visitInlinedDeclTypes(arrayTypeCtx.inlinedDeclTypes());
					typeIdText = 'Array';
					typeIdRange = rangeFromBound(arrayTypeCtx.start);
				}
			}
		}

		const typeSymbol = new UCTypeSymbol(
			{ name: typeIdText, range: typeIdRange }, undefined,
			{ range: rangeFromBounds(varTypeCtx.start, varTypeCtx.stop) }
		);
		typeSymbol.outer = this.get() as UCStructSymbol;
		typeSymbol.innerType = innerTypeSymbol;
		if (innerTypeSymbol) {
			innerTypeSymbol.outer = typeSymbol;
		}
		return typeSymbol;
	}

	private visitInlinedDeclTypes(inlinedTypeCtx: UCParser.InlinedDeclTypesContext): UCTypeSymbol {
		const inlinedStruct = inlinedTypeCtx.structDecl();
		if (inlinedStruct) {
			const structName = inlinedStruct.identifier();
			return new UCTypeSymbol(
				{ name: structName.text, range: rangeFromBounds(structName.start, structName.stop) }, UCTypeKind.Struct
			);
		}

		const inlinedEnum = inlinedTypeCtx.enumDecl();
		if (inlinedEnum) {
			const enumName = inlinedEnum.identifier();
			return new UCTypeSymbol(
				{ name: enumName.text, range: rangeFromBounds(enumName.start, enumName.stop) }, UCTypeKind.Enum
			);
		}
		return this.visitTypeDecl(inlinedTypeCtx.typeDecl());
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const varDeclType = ctx.inlinedDeclTypes();
		if (!varDeclType) {
			return;
		}

		const typeSymbol = this.visitInlinedDeclTypes(varDeclType);

		for (const varCtx of ctx.variable()) {
			const varName = varCtx.identifier();

			const symbol = new UCPropertySymbol(
				{ name: varName.start.text, range: rangeFromBound(varName.start) },

				// Stop at varCtx instead of ctx for mulitiple variable declarations.
				{ range: rangeFromBounds(ctx.start, varCtx.stop) }
			);
			symbol.type = typeSymbol;
			symbol.context = varCtx;
			this.declare(symbol);

			if (typeSymbol) {
				typeSymbol.outer = symbol.outer; // FIXME: Assign to current context instead.
			}
		}
	}

	enterReplicationBlock(ctx: UCParser.ReplicationBlockContext) {
		const nameCtx = ctx.kwREPLICATION();
		const symbol = new UCStructSymbol(
			{ name: nameCtx.text, range: rangeFromBound(nameCtx.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;
		this.class.repFieldRefs = [];
		this.declare(symbol);
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateId()) {
			const refSymbol = new UCReferenceSymbol({ name: varCtx.text, range: rangeFromBound(varCtx.start) });
			refSymbol.outer = this.class;
			this.class.repFieldRefs.push(refSymbol);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const nameCtx = ctx.functionName();
		if (!nameCtx) {
			return;
		}

		const funcSymbol = new UCMethodSymbol(
			// We need start and stop for functions with special symbols (which are made of multiple tokens)
			{ name: nameCtx.text, range: rangeFromBounds(nameCtx.start, nameCtx.stop) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		funcSymbol.context = ctx;
		this.declare(funcSymbol);
		this.push(funcSymbol);

		const returnTypeCtx = ctx.returnType();
		if (returnTypeCtx) {
			funcSymbol.returnType = this.visitTypeDecl(returnTypeCtx.typeDecl());
		}

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
					{ name: propName.text, range: rangeFromBound(propName.start) },
					{ range: rangeFromBounds(paramCtx.start, paramCtx.stop) }
				);

				const propTypeCtx = paramCtx.typeDecl();
				propSymbol.type = this.visitTypeDecl(propTypeCtx);
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
				const typeSymbol = this.visitTypeDecl(propTypeCtx);
				for (const varCtx of localCtx.variable()) {
					const propName = varCtx.identifier();
					if (!propName) {
						continue;
					}

					const propSymbol = new UCLocalSymbol(
						{ name: propName.text, range: rangeFromBound(propName.start) },
						// Stop at varCtx instead of localCtx for mulitiple variable declarations.
						{ range: rangeFromBounds(localCtx.start, varCtx.stop) }
					);
					propSymbol.type = typeSymbol;
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
			{ name: stateName.text, range: rangeFromBound(stateName.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;

		const extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			symbol.extendsType = this.visitExtendsClause(extendsCtx, UCTypeKind.State);
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStateDecl(ctx: UCParser.StateDeclContext) {
		this.pop();
	}

	enterDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		const nameCtx = ctx.kwDEFAULTPROPERTIES();
		const symbol = new UCDefaultPropertiesSymbol(
			{ name: nameCtx.text, range: rangeFromBound(nameCtx.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
	}

	enterObjectDecl(ctx: UCParser.ObjectDeclContext) {
		const symbol = new UCObjectSymbol(
			{ name: null, range: rangeFromBound(ctx.start) },
			{ range: rangeFromBounds(ctx.start, ctx.stop) }
		);
		symbol.context = ctx;

		this.declare(symbol);
		this.push(symbol);
	}

	enterDefaultVariable(ctx: UCParser.DefaultVariableContext) {
		const idCtx = ctx.defaultId();
		const refSymbol = new UCReferenceSymbol({ name: idCtx.text, range: rangeFromBound(ctx.start) });

		const context = this.get() as UCObjectSymbol;
		refSymbol.outer = context;

		const propNameLC = idCtx.text.toLowerCase();
		switch (propNameLC) {
			case 'name': {
				// TODO: change name
			}

			case 'class': {
				const typeSymbol = new UCTypeSymbol({
					name: refSymbol.getName(),
					range: rangeFromBounds(idCtx.start, idCtx.stop)
				}, UCTypeKind.Class);
				typeSymbol.outer = context;
				context.extendsType = typeSymbol;
			}
		}
		context.varRefs.set(propNameLC, refSymbol);

		const valCtx = ctx.defaultValue();
		if (valCtx) {
			const literal = valCtx.defaultLiteral();
			const structCtx = literal.structLiteral();
			if (structCtx) {
				const subSymbol = new UCObjectSymbol(
					// Use the same name as the assigned var's name.
					{ name: idCtx.text, range: rangeFromBound(structCtx.start) },
					{ range: rangeFromBounds(structCtx.start, structCtx.stop) }
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

const SymbolsTable = new UCPackage('Workspace');
SymbolsTable.addSymbol(CORE_PACKAGE);

const PathPackageMap = new Map<string, UCPackage>();

function getPackageFor(uri: string): UCPackage {
	const dir = path.parse(uri).dir;
	let packageSymbol: UCPackage = PathPackageMap.get(dir);
	if (packageSymbol) {
		return packageSymbol;
	}

	const dirs = dir.split('/');
	for (let i = dirs.length - 1; i >= 0; -- i) {
		if (i > 0 && dirs[i].toLowerCase() === 'classes') {
			const packageName = dirs[i - 1];

			packageSymbol = SymbolsTable.symbols.get(packageName) as UCPackage;
			if (packageSymbol) {
				return packageSymbol;
			}

			packageSymbol = new UCPackage(packageName);
			SymbolsTable.addSymbol(packageSymbol);

			PathPackageMap.set(dir, packageSymbol);

			return packageSymbol;
		}
	}
	return SymbolsTable;
}

export function getDocumentListenerByUri(uri: string): UCDocumentListener {
	let document: UCDocumentListener = Documents.get(uri);
	if (document) {
		return document;
	}

	const packageTable = getPackageFor(uri);

	document = new UCDocumentListener(packageTable, uri);
	document.getDocument = getDocumentListenerById;
	Documents.set(uri, document);
	return document;
}

export const ClassesMap$ = new BehaviorSubject(new Map<string, string>());

const Documents: Map<string, UCDocumentListener> = new Map<string, UCDocumentListener>();

function findUriForQualifiedId(qualifiedClassId: string): string | undefined {
	const filePath: string = ClassesMap$.value.get(qualifiedClassId);
	if (!filePath) {
		return undefined;
	}

	// FIXME: may not exist
	if (!fs.existsSync(filePath)) {
		return undefined;
	}

	const uriFromFilePath = URI.file(filePath).toString();
	return uriFromFilePath;
}

function getDocumentListenerById(qualifiedClassId: string, callback: (document: UCDocumentListener) => void) {
	console.log('Looking for external document ' + qualifiedClassId);

	// Try the shorter route first before we scan the entire workspace!
	if (SymbolsTable) {
		let classSymbol = SymbolsTable.findQualifiedSymbol(qualifiedClassId, true);
		if (classSymbol && classSymbol instanceof UCClassSymbol) {
			callback(classSymbol.document);
			return;
		}
	}

	const uri = findUriForQualifiedId(qualifiedClassId);
	if (!uri) {
		callback(undefined);
		return;
	}

	const document: UCDocumentListener = getDocumentListenerByUri(uri);
	if (document) {
		document.parse(document.readText());
		document.link();
	}
	callback(document);
}