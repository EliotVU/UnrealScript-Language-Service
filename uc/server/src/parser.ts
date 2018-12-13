import * as path from 'path';

import { Position, Range, SymbolKind } from 'vscode-languageserver-types';

import { Token, ParserRuleContext, CommonTokenStream } from 'antlr4ts';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';

import { UCGrammarListener } from './antlr/UCGrammarListener';
import { UCGrammarLexer } from './antlr/UCGrammarLexer';
import * as UCParser from './antlr/UCGrammarParser';

import { DiagnosticNode, CodeErrorNode } from './diagnostics';
import { CaseInsensitiveStream } from './CaseInsensitiveStream';

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
abstract class TokenItem {
	protected startToken: Token;
	protected stopToken: Token;
	protected commentToken: Token;

	protected tokens?: Token[];

	constructor(ctx: ParserRuleContext) {
		this.startToken = ctx.start;
		this.stopToken = ctx.stop;
	}

	getTooltip(token?: Token): string | undefined {
		return undefined;
	}

	getDocumentation(): string | undefined {
		return this.commentToken ? this.commentToken.text : undefined;
	}

	tryAddComment(stream: CommonTokenStream) {
		const tokens = stream.getHiddenTokensToLeft(this.startToken.tokenIndex, UCGrammarLexer.HIDDEN);
		if (tokens) {
			const lastToken = tokens.pop();
			if (lastToken) {
				this.commentToken = lastToken;
			}
		}
	}

	fetchTokens(stream: CommonTokenStream) {
		this.tokens = stream.getTokens(this.startToken.tokenIndex, this.stopToken.tokenIndex);
	}

	findTokenAtPosition(pos: Position): Token | undefined {
		return this.tokens.find(token => this.isTokenInPosition(token, pos));
	}

	getItemAtOffset(offset: number): TokenItem | undefined {
		var offsetIsContained = offset >= this.startToken.startIndex
			&& offset <= this.stopToken.stopIndex;

		if (offsetIsContained) {
			return this;
		}
		return undefined;
	}

	protected isTokenInPosition(token: Token, pos: Position): boolean {
		var begin: number = token.charPositionInLine;
		var end: number = begin + token.text.length;
		return token.line - 1 === pos.line
			&& pos.character >= begin
			&& pos.character <= end;
	}
}

export class UCField extends TokenItem {
	public outer?: UCField;
	public nameToken: Token;

	getName(): string {
		return this.nameToken.text;
	}

	getRange(): Range {
		return rangeFromToken(this.nameToken);
	}

	getKind(): SymbolKind {
		return SymbolKind.Field;
	}

	getTooltip(token?: Token): string {
		return this.outer
			? this.outer.getTooltip(token) + '.' + this.nameToken.text
			: this.nameToken.text;
	}

	link(document: UCDocument) {

	}
}

export class UCConst extends UCField {
	public valueToken: Token;

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getTooltip(token?: Token): string {
		return super.getTooltip() + ' : ' + this.valueToken.text;
	}
}

export class UCProperty extends UCField {
	public typeToken: Token;

	constructor(ctx: UCParser.VarDeclContext, stopToken: Token) {
		super(ctx);

		// Small hack neccessary to separate this UCProperty from a multiple-var-declaration case.
		this.stopToken = stopToken;
	}

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getTooltip(token?: Token): string {
		if (token) switch (token) {
			case this.typeToken:
				return this.typeToken.text;
		}
		return super.getTooltip() + ': ' + this.typeToken.text;
	}
}

export class UCEnum extends UCField {
	public valueTokens: Token[];

	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}
}

export class UCStruct extends UCField {
	public extendsToken?: Token;

	// TODO: Link (except for UCClass)
	public extends?: UCStruct;
	public fields?: UCField[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	getItemAtOffset(offset: number): TokenItem {
		for (let field of this.fields) {
			if (field.getItemAtOffset(offset)) {
				return field;
			}
		}
		return super.getItemAtOffset(offset);
	}

	public findFieldByName(name: string, deepSearch?: boolean) {
		for (let outer: UCStruct = this; outer; outer = outer.extends) {
			let field = outer.fields.find(f => f.nameToken.text.toLowerCase() === name);
			if (field) {
				return field;
			}

			if (!deepSearch) {
				break;
			}
		}
	}
}

export class UCFunction extends UCStruct {
	public returnTypeToken?: Token;

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}
}

export class UCClass extends UCStruct {
	public replicatedNameTokens: Token[] = [];
	public replicatedFields: UCField[];

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	public link(document: UCDocument) {
		const className = this.nameToken.text;
		const documentName = path.basename(document.uri, '.uc');
		if (className.toLowerCase() != documentName.toLowerCase()) {
			const errorNode = new CodeErrorNode(
				this.nameToken,
				`Class '${className}' name must be equal to its file name ${documentName}!`,
			);
			document.nodes.push(errorNode);
		}

		if (this.replicatedNameTokens) {
			this.replicatedFields = [];
			for (let nameToken of this.replicatedNameTokens) {
				let field: UCField = this.findFieldByName(nameToken.text.toLowerCase());
				if (field) {
					if (field instanceof UCProperty || field instanceof UCFunction) {
						this.replicatedFields.push(field);
					} else {
						const errorNode = new CodeErrorNode(
							nameToken,
							`Type of field '${nameToken.text}' is not replicatable!`
						);
						document.nodes.push(errorNode);
					}
				} else {
					const errorNode = new CodeErrorNode(
						nameToken,
						`Variable '${nameToken.text}' does not exist in class '${document.class.nameToken.text}'.`
					);
					document.nodes.push(errorNode);
				}
			}
		}
	}
}

export class UCDocument {
	public class: UCClass;
	public nodes: DiagnosticNode[] = [];

	private context: UCStruct[] = []; // FIXME: Type

	constructor(public uri: string) {

	}

	push(context: UCStruct) {
		this.context.push(context);
	}

	pop() {
		this.context.pop();
	}

	get(): UCStruct {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.class;
	}

	getItemAtOffset(offset: number): TokenItem {
		return this.class.getItemAtOffset(offset);
	}
}

class ScopeListener implements UCGrammarListener {
	public getDocument: (className: string) => UCDocument;

	constructor(private stream: CommonTokenStream, private document: UCDocument) {

	}

	pushField(field: UCField) {
		field.tryAddComment(this.stream);
		field.fetchTokens(this.stream);

		const context = this.document.get();
		field.outer = context;
		context.fields.push(field);
	}

	visitErrorNode(errNode: ErrorNode) {
		const node = new DiagnosticNode(errNode.symbol);
		this.document.nodes.push(node);
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		const parsedClass = new UCClass(ctx);
		this.document.class = parsedClass;
		parsedClass.nameToken = ctx.className().start;

		try {
			let extendsTree = ctx.classExtendsReference();
			if (extendsTree) {
				parsedClass.extendsToken = extendsTree.start;

				// FIXME: Move to link()
				let extendsClassName = extendsTree.text;
				let extendsDocument = this.getDocument(extendsClassName);
				if (extendsDocument) {
					parsedClass.extends = extendsDocument.class;
				}
			}
		} catch (err) {
			console.log(err);
		}

		this.document.push(parsedClass);
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const constant = new UCConst(ctx);
		constant.nameToken = ctx.constName().start;
		constant.valueToken = ctx.constValue().start;
		this.pushField(constant);
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const uEnum = new UCEnum(ctx);
		uEnum.nameToken = ctx.enumName().start;
		uEnum.valueTokens = [];
		for (const valueCtx of ctx.valueName()) {
			let valueToken = valueCtx.start;
			uEnum.valueTokens.push(valueToken);
		}
		this.pushField(uEnum);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const struct = new UCStruct(ctx);
		struct.nameToken = ctx.structName().start;

		let extendsTree = ctx.structReference();
		if (extendsTree) {
			struct.extendsToken = extendsTree.start;
		}

		this.pushField(struct);
		this.document.push(struct);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.document.pop();
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const propDeclType = ctx.variableDeclType();
		const propTypeToken = propDeclType.start;
		for (const varCtx of ctx.variable()) {
			let nameToken = varCtx.variableName().start;

			let prop = new UCProperty(ctx, varCtx.stop);
			prop.typeToken = propTypeToken;
			prop.nameToken = nameToken;
			this.pushField(prop);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const parsedFunction = new UCFunction(ctx);
		let returnTypeTree = ctx.returnType();
		if (returnTypeTree) {
			parsedFunction.returnTypeToken = returnTypeTree.start;
		}
		let functionNameTree = ctx.functionName();
		if (functionNameTree) {
			parsedFunction.nameToken = functionNameTree.start;
		}
		this.pushField(parsedFunction);
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateVariableName()) {
			let nameToken = varCtx.start;
			this.document.class.replicatedNameTokens.push(nameToken);
		}
	}
}

export class ScopeParser {
	private listener: ScopeListener;
	private lexer: UCGrammarLexer;
	private parser: UCParser.UCGrammarParser;
	private tokenStream: CommonTokenStream;

	private document: UCDocument;

	constructor(uri: string, text: string) {
		console.log('Constructing parser for', uri);

		// FIXME: toLowerCase hack because my LA override is not working.
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));

		this.tokenStream = new CommonTokenStream(this.lexer);
		this.parser = new UCParser.UCGrammarParser(this.tokenStream);
		this.parser.buildParseTree = true;

		this.document = new UCDocument(uri);
		this.listener = new ScopeListener(this.tokenStream, this.document);
	}

	parse(getDocument: (className: string) => UCDocument): UCDocument {
		this.listener.getDocument = getDocument;

		try {
			let tree = this.parser.program();
			ParseTreeWalker.DEFAULT.walk(this.listener, tree);
		} catch (err) {
			console.log('something went wrong parsing a document!', err);
		}
		return this.document;
	}

	link() {
		this.document.class.link(this.document);
	}
};