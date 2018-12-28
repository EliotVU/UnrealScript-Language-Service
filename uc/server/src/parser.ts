import * as path from 'path';

import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Location } from 'vscode-languageserver-types';

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

export const CLASS_DECLARATIONS = [
	'class', 'const', 'enum', 'struct', 'var',
	'function', 'event',
	'operator', 'preoperator', 'postoperator',
	'state',
	'cpptext',
	'defaultproperties'
];

export const STRUCT_DECLARATIONS = [
	'const', 'enum', 'struct', 'var',
	'structcpptext',
	'structdefaultproperties'
];

export const FUNCTION_DECLARATIONS = [
	'const', 'local'
];

export const STRUCT_MODIFIERS = [
	'native', 'long'
];

export const PRIMITIVE_TYPE_NAMES = [
	'int', 'float', 'byte', 'name', 'string',
	'bool', 'array', 'map', 'class', 'pointer'
];

export const COMMON_MODIFIERS = ['public', 'protected', 'private', 'const', 'native'];
export const FUNCTION_MODIFIERS = COMMON_MODIFIERS.concat(['simulated', 'final', 'static']);
export const VARIABLE_MODIFIERS = COMMON_MODIFIERS.concat(['config']);

interface ISimpleSymbol {
	outer?: ISimpleSymbol;
	getName(): string;
	getKind(): SymbolKind;
	getUri(): string;
	getTooltip(): string;
}

interface ITraversable extends ISimpleSymbol {
	symbols?: Map<string, ISimpleSymbol>;
	addSymbol(symbol: ISimpleSymbol): void;
	findInheritedSymbol<T>(name: string, deepSearch?: boolean): ISimpleSymbol;
}

/**
 * A symbol that resides in a document, holding a name, start and stop token.
 */
export abstract class UCDocSymbol implements ISimpleSymbol {
	public outer?: ISimpleSymbol;

	/** Locations that reference this symbol. */
	private links: Location[] = [];

	private startToken: Token;
	protected stopToken: Token;
	private commentToken: Token;
	protected tokens?: Token[];

	constructor(protected nameToken: Token, ctx: ParserRuleContext) {
		this.startToken = ctx.start;
		this.stopToken = ctx.stop;
	}

	getTooltip(): string | undefined {
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

	getFullRange(): Range {
		return rangeFromTokens(this.startToken, this.stopToken);
	}

	getSize(): number {
		return this.stopToken.stopIndex - this.getOffset();
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(this.getName(), this.getKind(), this.getFullRange(), undefined, this.outer.getName());
	}

	toCompletionItem(): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.documentation = this.getDocumentation();
		item.kind = this.getKind() as any as CompletionItemKind;
		return item;
	}

	getSymbolAtOffset(offset: number): UCDocSymbol | undefined {
		var offsetIsContained = offset >= this.getOffset()
			&& offset <= this.stopToken.stopIndex;

		if (offsetIsContained) {
			return this;
		}
		return undefined;
	}

	public findOuterSymbol<T>(name: string, deepSearch?: boolean) {
		name = name.toLowerCase();
		for (let outer: ISimpleSymbol = this; outer; outer = outer.outer) {
			if (outer['findInheritedSymbol']) {
				let symbol = (outer as ITraversable).findInheritedSymbol<T>(name, deepSearch);
				if (symbol) {
					return symbol;
				}
			}

			if (!deepSearch) {
				break;
			}
		}
	}

	link(document: UCDocument) {

	}

	linkLocation(location: Location) {
		this.links.push(location);
	}

	getLinks(): Location[] | undefined {
		return this.links;
	}

	getUri(): string {
		return this.outer.getUri();
	}
}

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolRef extends UCDocSymbol {
	protected reference?: ISimpleSymbol;

	getTooltip(): string {
		if (!this.reference) {
			return this.getName();
		}
		return this.reference.getTooltip();
	}

	link(document: UCDocument) {
		// TODO: verify type, and parse classes that are not within scope!
		this.reference = document.class.findOuterSymbol<UCField>(this.getName(), true);
		if (!this.reference) {
			document.nodes.push(new CodeErrorNode(this.nameToken, `Type '${this.getName()}' not found!`));
		}
	}

	setReference(symbol: ISimpleSymbol) {
		this.reference = symbol;
	}

	getReference(): ISimpleSymbol | undefined {
		return this.reference;
	}
}

export class UCStructRef extends UCSymbolRef {

}

export class UCClassRef extends UCStructRef {
	public link(document: UCDocument) {
		let classDoc = document.getDocument(this.getName());
		if (classDoc) {
			this.setReference(classDoc.class);
			classDoc.class.linkLocation(Location.create(document.uri, rangeFromToken(this.nameToken)));
			classDoc.class.link(classDoc);
		} else {
			const errorNode = new CodeErrorNode(
				this.nameToken,
				`Class '${this.nameToken.text}' does not exist in the Workspace!`,
			);
			document.nodes.push(errorNode);
		}
	}
}

export class UCField extends UCDocSymbol {
	getTooltip(): string {
		return this.getFullName();
	}
}

export class UCConst extends UCField {
	public valueToken: Token;

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getTooltip(): string {
		return '(const) ' + super.getTooltip() + ' : ' + this.valueToken.text;
	}
}

export class UCProperty extends UCField {
	public typeRef?: UCSymbolRef;

	constructor(nameToken: Token, ctx: ParserRuleContext, stopToken: Token) {
		super(nameToken, ctx);

		// Small hack neccessary to separate this UCProperty from a multiple-var-declaration case.
		this.stopToken = stopToken;
	}

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getTooltip(): string {
		if (this.typeRef) {
			return '(variable) ' + this.getName() + ': ' + this.getTypeText();
		}
		return '(variable) ' + this.getName();
	}

	getTypeText(): string {
		return this.typeRef.getFullName();
	}

	getSymbolAtOffset(offset: number): UCDocSymbol | undefined {
		var symbol = super.getSymbolAtOffset(offset);
		if (symbol === this) {
			if (this.typeRef && this.typeRef.getSymbolAtOffset(offset)) {
				return this.typeRef;
			}
		}
		return symbol;
	}

	public link(document: UCDocument) {
		super.link(document);

		if (this.typeRef) {
			this.typeRef.link(document);
		}
	}
}

export class UCEnum extends UCField {
	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getName()}`;
	}
}

export class UCEnumMember extends UCField {
	getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	getTooltip(): string {
		return `(enum member) ${this.outer.getName()}.${this.getName()}`;
	}
}

export class UCStruct extends UCField implements ITraversable {
	public extendsRef?: UCStructRef;

	// TODO: Link (except for UCClass)
	public extends?: UCStruct;
	public symbols: Map<string, UCDocSymbol> = new Map();

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `struct ${this.getName()}`;
	}

	addSymbol(symbol: UCDocSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	getSymbolAtOffset(offset: number): UCDocSymbol | undefined {
		var symbol = super.getSymbolAtOffset(offset);
		if (symbol == this) {
			if (this.extendsRef && this.extendsRef.getSymbolAtOffset(offset)) {
				return this.extendsRef;
			}
		}

		// Check for children before considering ourself.
		// HACK: Special case for UCClass as it can have symbols outside of its range.
		if (this instanceof UCClass || symbol == this) {
			for (let subSymbol of this.symbols.values()) {
				subSymbol = subSymbol.getSymbolAtOffset(offset);
				if (subSymbol) {
					return subSymbol;
				}
			}
		}
		return symbol;
	}

	findInheritedSymbol<T>(name: string, deepSearch?: boolean) {
		name = name.toLowerCase();
		for (let superSymbol: UCStruct = this; superSymbol; superSymbol = superSymbol.extends) {
			let symbol = superSymbol.symbols.get(name);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
	}

	link(document: UCDocument) {
		if (this.extendsRef) {
			this.extendsRef.link(document);
			// Temp hack
			this.extends = this.extendsRef.getReference() as UCStruct;
		}

		for (let symbol of this.symbols.values()) {
			symbol.link(document);
		}
	}
}

export class UCScriptStruct extends UCStruct {
	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}
}

export class UCDefaultProperty extends UCProperty {
	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	public link(document: UCDocument) {
		// var defaults = (this.outer as UCDefaults);

		// this.reference = defaults.findOuterSymbol(this.getName(), true);
		// if (this.reference) {
		// 	this.reference.linkLocation(Location.create(document.uri, rangeFromToken(this.nameToken)));
		// }
	}
}

export class UCDefaults extends UCStruct {

}

export class UCFunction extends UCStruct {
	public returnTypeRef?: UCSymbolRef;
	public returnTypeSymbol?: UCDocSymbol;
	public params: UCProperty[] = [];

	constructor(nameToken: Token, nameCtx: UCParser.FunctionNameContext, ctx: ParserRuleContext,) {
		super(ctx.start.tokenSource.tokenFactory.create(
			{ source: nameToken.tokenSource, stream: nameToken.inputStream },
			nameToken.type,
			nameCtx.text,
			nameToken.channel,
			nameToken.startIndex,
			nameToken.stopIndex,
			nameToken.line,
			nameToken.line
		), ctx);
	}

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getTooltip(): string {
		return '(method) ' + super.getTooltip() + this.buildArguments() + this.buildReturnType();
	}

	getSymbolAtOffset(offset: number): UCDocSymbol | undefined {
		var symbol = super.getSymbolAtOffset(offset);
		if (symbol === this) {
			if (this.returnTypeRef && this.returnTypeRef.getSymbolAtOffset(offset)) {
				return this.returnTypeRef;
			}
		}
		return symbol;
	}

	public link(document: UCDocument) {
		super.link(document);

		if (this.returnTypeRef) {
			this.returnTypeRef.link(document);
		}
	}

	private buildReturnType(): string {
		return this.returnTypeRef ? ': ' + this.returnTypeRef.getName() : '';
	}

	private buildArguments(): string {
		return `(${this.params.map(f => f.getTypeText() + ' ' + f.getName()).join(', ')})`;
	}
}

export class UCState extends UCStruct {
	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getName()}`;
	}
}

export class UCClass extends UCStruct {
	public isLinked: boolean = false;
	public document: UCDocument;

	public withinRef?: UCDocSymbol;

	public replicatedNameTokens: Token[] = [];
	public replicatedSymbols?: UCDocSymbol[];

	public static visit(document: UCDocument, ctx: UCParser.ClassDeclContext): UCClass {
		var symbol = new UCClass(ctx.className().start, ctx);

		var extendsCtx = ctx.classExtendsReference();
		if (extendsCtx) {
			symbol.extendsRef = new UCClassRef(extendsCtx.start, extendsCtx);
		}

		var withinCtx = ctx.classWithinReference();
		if (withinCtx) {
			symbol.withinRef = new UCClassRef(withinCtx.start, withinCtx);
		}

		return symbol;
	}

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	getTooltip(): string {
		if (!this.extendsRef) {
			return `class ${this.getName()}`;
		}
		return `class ${this.getName()}: ${this.extendsRef.getFullName()}`;
	}

	getUri(): string {
		return this.document.uri;
	}

	getSymbolAtOffset(offset: number): UCDocSymbol | undefined {
		var symbol = super.getSymbolAtOffset(offset);
		if (symbol === this) {
			if (this.withinRef && this.withinRef.getSymbolAtOffset(offset)) {
				return this.withinRef;
			}
		}
		return symbol;
	}

	link(document: UCDocument) {
		this.document = document;
		// To prevent infinite recursive loops where a class is extending itself.
		if (this.isLinked) {
			return;
		}
		this.isLinked = true;

		if (this.withinRef) {
			this.withinRef.link(document);
		}

		super.link(document);

		const className = this.getName();
		const documentName = path.basename(document.uri, '.uc');
		if (className.toLowerCase() != documentName.toLowerCase()) {
			const errorNode = new CodeErrorNode(
				this.nameToken,
				`Class name '${className}' must be equal to its file name ${documentName}!`,
			);
			document.nodes.push(errorNode);
		}

		if (this.replicatedNameTokens) {
			this.replicatedSymbols = [];
			for (let nameToken of this.replicatedNameTokens) {
				let symbol = this.findInheritedSymbol(nameToken.text);
				if (symbol) {
					symbol.linkLocation(Location.create(document.uri, rangeFromToken(nameToken)));
					this.replicatedSymbols.push(symbol);
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

export class UCNativeSymbol implements ISimpleSymbol {
	constructor(private name: string) {

	}

	getName(): string {
		return this.name;
	}

	getKind(): SymbolKind {
		return SymbolKind.TypeParameter;
	}

	getUri(): string | undefined {
		return undefined;
	}

	getTooltip(): string {
		return `(alias) ${this.getName()}`;
	}
}

export const NATIVE_SYMBOLS = [
	new UCNativeSymbol('byte'),
	new UCNativeSymbol('float'),
	new UCNativeSymbol('int'),
	new UCNativeSymbol('string'),
	new UCNativeSymbol('name'),
	new UCNativeSymbol('bool'),
	new UCNativeSymbol('button'),
	new UCNativeSymbol('pointer'),
	new UCNativeSymbol('class'),
	new UCNativeSymbol('map'),
	new UCNativeSymbol('array')
];

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ITraversable {
	public outer = null;
	public symbols = new Map<string, ISimpleSymbol>();

	private name: string;

	constructor(private uri: string) {
		this.name = path.basename(uri);
	}

	getName(): string {
		return this.name;
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getUri(): string {
		throw new Error("getUri not implemented");
		return "";
	}

	getTooltip(): string {
		return this.getName();
	}

	addSymbol(symbol: ISimpleSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	public findInheritedSymbol(name: string, deepSearch?: boolean): ISimpleSymbol {
		name = name.toLowerCase();
		return this.symbols.get(name);
	}
}

export class UCDocument implements UCGrammarListener, ANTLRErrorListener<Token> {
	public getDocument: (className: string) => UCDocument;

	public class: UCClass;
	public nodes: DiagnosticNode[] = [];

	private context: UCStruct[] = []; // FIXME: Type

	constructor(public classPackage: UCPackage, public uri: string, private stream: CommonTokenStream) {

	}

	push(newContext: UCStruct) {
		this.context.push(newContext);
	}

	pop() {
		this.context.pop();
	}

	get(): ITraversable {
		return this.context.length > 0
			? this.context[this.context.length - 1]
			: this.classPackage;
	}

	declare(symbol: UCDocSymbol) {
		const context = this.get();
		context.addSymbol(symbol);

		symbol.tryAddComment(this.stream);
		symbol.fetchTokens(this.stream);
	}

	getSymbolAtOffset(offset: number): UCDocSymbol {
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
		const symbol = UCClass.visit(this, ctx);
		this.class = symbol;

		this.declare(symbol); // push to package
		this.push(symbol);
	}

	enterConstDecl(ctx: UCParser.ConstDeclContext) {
		const nameToken = ctx.constName().start;
		const symbol = new UCConst(nameToken, ctx);
		symbol.valueToken = ctx.constValue().start;
		this.declare(symbol);
	}

	enterEnumDecl(ctx: UCParser.EnumDeclContext) {
		const nameToken = ctx.enumName().start;
		const symbol = new UCEnum(nameToken, ctx);
		for (const valueCtx of ctx.valueName()) {
			const member = new UCEnumMember(valueCtx.start, valueCtx);
			this.declare(member);
			// HACK: overwrite define() outer let.
			member.outer = symbol;
		}
		this.declare(symbol);
	}

	enterStructDecl(ctx: UCParser.StructDeclContext) {
		const nameToken = ctx.structName().start;
		const symbol = new UCScriptStruct(nameToken, ctx);

		const extendsCtx = ctx.structReference();
		if (extendsCtx) {
			symbol.extendsRef = new UCStructRef(extendsCtx.start, ctx);
		}

		this.declare(symbol);
		this.push(symbol);
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
			prop.typeRef = new UCSymbolRef(propTypeToken, propDeclType);
			this.declare(prop);
		}
	}

	enterReplicationBlock(ctx: UCParser.ReplicationBlockContext) {
		var symbol = new UCStruct(ctx.start, ctx);
		this.declare(symbol);
	}

	enterReplicationStatement(ctx: UCParser.ReplicationStatementContext) {
		for (const varCtx of ctx.replicateVariableName()) {
			let nameToken = varCtx.start;
			this.class.replicatedNameTokens.push(nameToken);
		}
	}

	enterFunctionDecl(ctx: UCParser.FunctionDeclContext) {
		const nameCtx = ctx.functionName();
		const symbol = new UCFunction(nameCtx.start, nameCtx, ctx);
		const returnTypeTree = ctx.returnType();
		if (returnTypeTree) {
			symbol.returnTypeRef = new UCSymbolRef(returnTypeTree.start, returnTypeTree);
		}
		this.declare(symbol);
		this.push(symbol);

		for (const paramCtx of ctx.paramDecl()) {
			const propTypeCtx = paramCtx.variableType();
			const varCtx = paramCtx.variable();
			const nameToken = varCtx.variableName().start;

			const prop = new UCProperty(nameToken, paramCtx, paramCtx.stop);
			prop.typeRef = new UCSymbolRef(propTypeCtx.start, propTypeCtx);
			symbol.params.push(prop);
			this.declare(prop);
		}

		for (const localCtx of ctx.localDecl()) {
			const propTypeCtx = localCtx.variableType();
			for (const varCtx of localCtx.variable()) {
				const nameToken = varCtx.variableName().start;
				const prop = new UCProperty(nameToken, localCtx, localCtx.stop);
				prop.typeRef = new UCSymbolRef(propTypeCtx.start, propTypeCtx);
				this.declare(prop);
			}
		}
		this.pop();
	}

	enterStateDecl(ctx: UCParser.StateDeclContext) {
		var symbol = new UCState(ctx.start, ctx);
		this.declare(symbol);
		this.push(symbol);
	}

	exitStateDecl(ctx: UCParser.StateDeclContext) {
		this.pop();
	}

	enterDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		var symbol = new UCDefaults(ctx.start, ctx);
		this.declare(symbol);
		this.push(symbol);
	}

	enterDefaultProperty(ctx: UCParser.DefaultPropertyContext) {
		var idCtx = ctx.ID();
		var symbol = new UCDefaultProperty(idCtx.symbol, ctx, ctx.stop);
		this.declare(symbol);
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

	constructor(uri: string, text: string, classPackage: UCPackage) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));

		this.tokenStream = new CommonTokenStream(this.lexer);
		this.parser = new UCParser.UCGrammarParser(this.tokenStream);
		this.parser.buildParseTree = true;

		this.document = new UCDocument(classPackage, uri, this.tokenStream);
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