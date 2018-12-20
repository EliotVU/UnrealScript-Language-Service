import * as path from 'path';

import { Position, Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';

import { Token, ParserRuleContext, CommonTokenStream, ANTLRErrorListener, RecognitionException, Recognizer } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

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

export const PRIMITIVE_TYPE_NAMES = ['int', 'float', 'byte', 'name', 'string', 'bool', 'array', 'map', 'class', 'pointer'];

abstract class UCSymbol {
	public outer?: UCSymbol;

	private startToken: Token;
	protected stopToken: Token;
	private commentToken: Token;

	protected tokens?: Token[];

	constructor(protected nameToken: Token, ctx: ParserRuleContext) {
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

	getToken(): Token | undefined {
		return this.nameToken;
	}

	getName(): string | 'None' {
		return this.nameToken ? this.nameToken.text : 'None';
	}

	getFullName(): string {
		var fullName = this.getName();
		for (var outer = this.outer; outer; outer = outer.outer) {
			fullName = outer.getName() + '.' + fullName;
		}
		return fullName;
	}

	getKind(): SymbolKind {
		return SymbolKind.Field;
	}

	getOffset(): number {
		return this.startToken.startIndex;
	}

	getRange(): Range {
		return rangeFromToken(this.nameToken);
	}

	getSize(): number {
		return this.stopToken.stopIndex - this.getOffset();
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(this.getName(), this.getKind(), this.getRange(), undefined, this.outer.getName());
	}

	toCompletionItem(): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.documentation = this.getDocumentation();
		item.kind = this.getKind() as any as CompletionItemKind;
		return item;
	}

	findTokenAtPosition(pos: Position): Token | undefined {
		return this.tokens.find(token => this.isTokenInPosition(token, pos));
	}

	getSymbolAtOffset(offset: number): UCSymbol | undefined {
		var offsetIsContained = offset >= this.getOffset()
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

	link(document: UCDocument) {

	}
}

export class UCField extends UCSymbol {
	getTooltip(token?: Token): string {
		return this.getFullName();
	}
}

export class UCConst extends UCField {
	public valueToken: Token;

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getTooltip(token?: Token): string {
		return '(const) ' + super.getTooltip() + ' : ' + this.valueToken.text;
	}
}

export class UCProperty extends UCField {
	public typeToken: Token;

	constructor(nameToken: Token, ctx: ParserRuleContext, stopToken: Token) {
		super(nameToken, ctx);

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
		return '(property) ' + super.getTooltip() + ': ' + this.getTypeText();
	}

	getTypeText(): string {
		return this.typeToken.text;
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
	public symbols: Map<string, UCSymbol> = new Map();

	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	getSymbolAtOffset(offset: number): UCSymbol {
		for (let symbol of this.symbols.values()) {
			if (symbol.getSymbolAtOffset(offset)) {
				return symbol;
			}
		}
		return super.getSymbolAtOffset(offset);
	}

	public addSymbol(symbol: UCSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	public findSymbol(name: string, deepSearch?: boolean) {
		name = name.toLowerCase();
		for (let outer: UCStruct = this; outer; outer = outer.extends) {
			let symbol = outer.symbols.get(name);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
	}

	public findOuterSymbol(name: string, deepSearch?: boolean) {
		name = name.toLowerCase();
		for (let outer: UCStruct = this; outer as UCStruct; outer = outer.outer as UCStruct) {
			let symbol = outer.symbols.get(name);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
	}

	public link(document: UCDocument) {
		if (this.extendsToken && !this.extends) {
			this.extends = this.findOuterSymbol(this.extendsToken.text, true) as UCStruct;
			if (this.extends) {
				console.log('found type for', this.getTooltip(), this.extends.getTooltip());
			}
		}

		for (let symbol of this.symbols.values()) {
			symbol.link(document);
		}
	}
}

export class UCFunction extends UCStruct {
	public returnTypeToken?: Token;
	public returnTypeField?: UCSymbol;
	public params: UCProperty[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getTooltip(token?: Token): string {
		if (token) switch (token) {
			case this.returnTypeToken:
				return this.returnTypeToken.text;
		}

		return '(method) ' + super.getTooltip() + this.buildArguments() + this.buildReturnType();
	}

	private buildReturnType(): string {
		return this.returnTypeToken ? ': ' + this.returnTypeToken.text : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}

	public link(document: UCDocument) {
		super.link(document);

		if (this.returnTypeToken) {
			this.returnTypeField = document.class.findOuterSymbol(this.returnTypeToken.text, true);
			if (this.returnTypeField) {
				console.log('found type for', this.getTooltip(), this.returnTypeField.getTooltip());
			}
		}
	}
}

export class UCClass extends UCStruct {
	public replicatedNameTokens: Token[] = [];
	public replicatedFields: UCSymbol[];
	public isLinked: boolean = false;

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	public link(document: UCDocument) {
		// To prevent infinite recursive loops where a class is extending itself.
		if (this.isLinked) {
			return;
		}
		this.isLinked = true;

		if (this.extendsToken) {
			let extendsDocument = document.getDocument(this.extendsToken.text);
			if (extendsDocument) {
				this.extends = extendsDocument.class;
				extendsDocument.class.link(extendsDocument);
			}
		}

		super.link(document);

		const className = this.getName();
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
				let symbol = this.findSymbol(nameToken.text);
				if (symbol) {
					this.replicatedFields.push(symbol);
					if (symbol instanceof UCProperty || symbol instanceof UCFunction) {
						continue;
					} else {
						const errorNode = new CodeErrorNode(
							nameToken,
							`Type of field '${symbol.getName()}' is not replicatable!`
						);
						document.nodes.push(errorNode);
					}
				} else {
					const errorNode = new CodeErrorNode(
						nameToken,
						`Variable '${nameToken.text}' does not exist in class '${document.class.getName()}'.`
					);
					document.nodes.push(errorNode);
				}
			}
		}
	}
}

export class UCDocument implements UCGrammarListener, ANTLRErrorListener<Token> {
	public getDocument: (className: string) => UCDocument;

	public class: UCClass;
	public nodes: DiagnosticNode[] = [];

	private context: UCStruct[] = []; // FIXME: Type

	constructor(public uri: string, private stream: CommonTokenStream) {

	}

	push(newContext: UCStruct) {
		this.context.push(newContext);
	}

	pop() {
		this.context.pop();
	}

	get(): UCStruct {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.class;
	}

	define(symbol: UCSymbol) {
		const context = this.get();
		context.addSymbol(symbol);

		symbol.tryAddComment(this.stream);
		symbol.fetchTokens(this.stream);
	}

	getSymbolAtOffset(offset: number): UCSymbol {
		return this.class.getSymbolAtOffset(offset);
	}

	syntaxError(recognizer: Recognizer<Token, any>, offendingSymbol: Token | undefined, line: number, charPositionInLine: number, msg: string, e: RecognitionException | undefined) {
		this.nodes.push(new CodeErrorNode(offendingSymbol, 'ANTLR Error | ' + msg));
	}

	visitErrorNode(errNode: ErrorNode) {
		// const node = new CodeErrorNode(errNode.symbol, errNode.text);
		// this.nodes.push(node);
	}

	enterClassDecl(ctx: UCParser.ClassDeclContext) {
		const nameToken = ctx.className().start;
		const parsedClass = new UCClass(nameToken, ctx);
		this.class = parsedClass;

		let extendsClassName = ctx.classExtendsReference().text;
		if (extendsClassName === '') {
			extendsClassName = 'Class';
		}
		this.push(parsedClass);
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const nameToken = ctx.constName().start;
		const constant = new UCConst(nameToken, ctx);
		constant.valueToken = ctx.constValue().start;
		this.define(constant);
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const nameToken = ctx.enumName().start;
		const uEnum = new UCEnum(nameToken, ctx);
		uEnum.valueTokens = [];
		for (const valueCtx of ctx.valueName()) {
			const valueToken = valueCtx.start;
			uEnum.valueTokens.push(valueToken);
		}
		this.define(uEnum);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const nameToken = ctx.structName().start;
		const struct = new UCStruct(nameToken, ctx);

		const extendsTree = ctx.structReference();
		if (extendsTree) {
			struct.extendsToken = extendsTree.start;
		}

		this.define(struct);
		this.push(struct);
	}

	exitStructDecl(ctx: UCParser.StructDeclContext) {
		this.pop();
	}

	enterVarDecl(ctx: UCParser.VarDeclContext) {
		const propDeclType = ctx.variableDeclType();
		const propTypeToken = propDeclType.start;
		for (const varCtx of ctx.variable()) {
			const nameToken = varCtx.variableName().start;

			const prop = new UCProperty(nameToken, ctx, varCtx.stop);
			prop.typeToken = propTypeToken;
			this.define(prop);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const nameToken = ctx.functionName().start;
		const parsedFunction = new UCFunction(nameToken, ctx);
		const returnTypeTree = ctx.returnType();
		if (returnTypeTree) {
			parsedFunction.returnTypeToken = returnTypeTree.start;
		}
		this.define(parsedFunction);
		this.push(parsedFunction);

		for (const paramCtx of ctx.paramDecl()) {
			const propTypeToken = paramCtx.variableType().start;
			const varCtx = paramCtx.variable();
			const nameToken = varCtx.variableName().start;

			const prop = new UCProperty(nameToken, varCtx, paramCtx.stop);
			prop.typeToken = propTypeToken;
			parsedFunction.params.push(prop);
			this.define(prop);
		}

		for (const localCtx of ctx.localDecl()) {
			const propTypeToken = localCtx.variableType().start;
			for (const varCtx of localCtx.variable()) {
				const nameToken = varCtx.variableName().start;
				const prop = new UCProperty(nameToken, localCtx, localCtx.stop);
				prop.typeToken = propTypeToken;
				this.define(prop);
			}
		}
		this.pop();
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateVariableName()) {
			let nameToken = varCtx.start;
			this.class.replicatedNameTokens.push(nameToken);
		}
	}

	enterDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		var symbol = new UCStruct(ctx.start, ctx);
		this.define(symbol);
		this.push(symbol);
	}

	exitDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		this.pop();
	}
}

export class DocumentParser {
	private lexer: UCGrammarLexer;
	private parser: UCParser.UCGrammarParser;
	private tokenStream: CommonTokenStream;

	private document: UCDocument;

	constructor(uri: string, text: string) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));

		this.tokenStream = new CommonTokenStream(this.lexer);
		this.parser = new UCParser.UCGrammarParser(this.tokenStream);
		this.parser.buildParseTree = true;

		this.document = new UCDocument(uri, this.tokenStream);
	}

	parse(getDocument: (className: string) => UCDocument): UCDocument {
		this.document.getDocument = getDocument;

		this.parser.addErrorListener(this.document);
		let tree = this.parser.program();
		ParseTreeWalker.DEFAULT.walk(this.document, tree);
		return this.document;
	}

	link() {
		this.document.class.link(this.document);
	}
}