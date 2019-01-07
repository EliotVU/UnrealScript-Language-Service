import * as path from 'path';

import { Range, SymbolKind, SymbolInformation, CompletionItem, CompletionItemKind, Location, Position } from 'vscode-languageserver-types';

import { Token, CommonTokenStream, ANTLRErrorListener, RecognitionException, Recognizer } from 'antlr4ts';
import { ErrorNode } from 'antlr4ts/tree/ErrorNode';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';

import { UCGrammarListener } from './antlr/UCGrammarListener';
import { UCGrammarLexer } from './antlr/UCGrammarLexer';
import * as UCParser from './antlr/UCGrammarParser';

import { SemanticErrorNode, SyntaxErrorNode, IDiagnosticNode } from './diagnostics';
import { CaseInsensitiveStream } from './CaseInsensitiveStream';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';

function rangeFromToken(token: Token): Range {
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

function rangeFromTokens(startToken: Token, stopToken: Token): Range {
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

export interface ISymbolId {
	name: string;
	range: Range;
}

export interface ISymbolOffset {
	range: Range;
}

/**
 * A symbol that resides in a document, holding a name, start and stop token.
 */
export abstract class UCSymbol implements ISimpleSymbol {
	public outer?: ISimpleSymbol;

	/** Locations that reference this symbol. */
	private links?: Location[];
	private commentToken?: Token;

	constructor(private id: ISymbolId) {

	}

	getTooltip(): string | undefined {
		return undefined;
	}

	getDocumentation(): string | undefined {
		return this.commentToken ? this.commentToken.text : undefined;
	}

	// tryAddComment() {
	// 	const tokens = stream.getHiddenTokensToLeft(this.offset, UCGrammarLexer.HIDDEN);
	// 	if (tokens) {
	// 		const lastToken = tokens.pop();
	// 		if (lastToken) {
	// 			this.commentToken = lastToken;
	// 		}
	// 	}
	// }

	getName(): string {
		return this.id.name;
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

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Text;
	}

	getRange(): Range {
		return this.getIdRange();
	}

	getIdRange(): Range {
		return this.id.range;
	}

	protected isIdWithinPosition(position: Position): boolean {
		var range = this.id.range;
		var isInRange = position.line >= range.start.line && position.line <= range.end.line
				&& position.character >= range.start.character && position.character <= range.end.character;
		return isInRange;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isIdWithinPosition(position)) {
			return this;
		}
		return undefined;
	}

	link(_document: UCDocument) {

	}

	linkLocation(location: Location) {
		if (!this.links) {
			this.links = [];
		}
		this.links.push(location);
	}

	getLinks(): Location[] | undefined {
		return this.links;
	}

	getUri(): string {
		return this.outer.getUri();
	}

	toSymbolInfo(): SymbolInformation {
		return SymbolInformation.create(this.getName(), this.getKind(), this.getRange(), undefined, this.outer.getName());
	}

	toCompletionItem(): CompletionItem {
		const item = CompletionItem.create(this.getName());
		item.detail = this.getTooltip();
		item.documentation = this.getDocumentation();
		item.kind = this.getCompletionItemKind();
		return item;
	}
}

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolRef extends UCSymbol {
	protected hasBeenLinked?: boolean;
	protected reference?: ISimpleSymbol;

	getTooltip(): string {
		if (!this.reference) {
			return this.getName();
		}
		return this.reference.getTooltip();
	}

	getLinks(): Location[] | undefined {
		var ref = this.getReference();
		return ref instanceof UCSymbol ? ref.getLinks() : super.getLinks();
	}

	setReference(symbol: ISimpleSymbol) {
		this.reference = symbol;
	}

	getReference(): ISimpleSymbol | undefined {
		return this.reference;
	}
}

export class UCTypeRef extends UCSymbolRef {
	public InnerTypeRef?: UCTypeRef;

	getTooltip(): string {
		var tooltip = super.getTooltip();
		if (this.InnerTypeRef) {
			tooltip = tooltip + `<${this.InnerTypeRef.getTooltip()}>`;
		}
		return tooltip;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isIdWithinPosition(position)) {
			if (this.InnerTypeRef) {
				return this.InnerTypeRef.getSymbolAtPos(position) || this;
			}
			return this;
		}
		return undefined;
	}

	link(document: UCDocument) {
		if (this.hasBeenLinked) {
			return;
		}
		this.hasBeenLinked = true;

		if (!this.getName()) {
			return;
		}

		// TODO: verify type, and parse classes that are not within scope!
		this.reference = document.class.findSuperTypeSymbol(this.getName(), true);
		if (!this.reference) {
			// TODO: only check for existance first
			let classDoc = document.getDocument(this.getName());
			if (classDoc) {
				this.setReference(classDoc.class);
				classDoc.class.linkLocation(Location.create(document.uri, this.getIdRange()));
				classDoc.class.document = classDoc; // temp hack
				// classDoc.class.link(classDoc);
			} else {
				document.nodes.push(new SemanticErrorNode(this, `Type '${this.getName()}' not found!`));
			}
		}
		else if (this.reference instanceof UCSymbol) {
			this.reference.linkLocation(Location.create(document.uri, this.getIdRange()));
		}

		if (this.InnerTypeRef) {
			this.InnerTypeRef.link(document);
		}
	}
}

export class UCStructRef extends UCTypeRef {

}

export class UCStateRef extends UCTypeRef {

}

export class UCClassRef extends UCStructRef {
	public link(document: UCDocument) {
		if (this.hasBeenLinked) {
			return;
		}
		this.hasBeenLinked = true;

		let classDoc = document.getDocument(this.getName());
		if (classDoc) {
			this.setReference(classDoc.class);
			classDoc.class.linkLocation(Location.create(document.uri, this.getIdRange()));
			classDoc.class.document = classDoc; // temp hack
			// classDoc.class.link(classDoc);
		} else {
			const errorNode = new SemanticErrorNode(
				this,
				`Class '${this.getName()}' does not exist in the Workspace!`,
			);
			document.nodes.push(errorNode);
		}
	}
}

export class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;

	constructor(id: ISymbolId, private offset: ISymbolOffset) {
		super(id);
	}

	getTooltip(): string {
		return this.getFullName();
	}

	getRange(): Range {
		return this.offset.range;
	}

	isWithinPosition(position: Position) {
		var range = this.getRange();
		var isInRange = position.line >= range.start.line && position.line <= range.end.line;
		if (isInRange) {
			if (position.line == range.start.line) {
				return position.character >= range.start.character;
			}

			if (position.line == range.end.line) {
				return position.character <= range.end.character;
			}
		}
		return isInRange;
	}
}

export class UCConstSymbol extends UCFieldSymbol {
	public valueToken: Token;

	getKind(): SymbolKind {
		return SymbolKind.Constant;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Constant;
	}

	getTooltip(): string {
		return '(const) ' + this.getName() + ' : ' + this.valueToken.text;
	}
}

export class UCPropertySymbol extends UCFieldSymbol {
	public typeRef?: UCTypeRef;

	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTooltip(): string {
		if (this.typeRef) {
			return '(variable) ' + this.getName() + ': ' + this.getTypeText();
		}
		return '(variable) ' + this.getName();
	}

	getTypeText(): string {
		return this.typeRef.getTooltip();
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}

			if (this.typeRef && this.typeRef.getSymbolAtPos(position)) {
				return this.typeRef;
			}
		}
		return undefined;
	}

	public link(document: UCDocument) {
		super.link(document);

		if (this.typeRef) {
			this.typeRef.link(document);
		}
	}
}

export class UCEnumSymbol extends UCFieldSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Enum;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Enum;
	}

	getTooltip(): string {
		return `enum ${this.getName()}`;
	}
}

export class UCEnumMemberSymbol extends UCSymbol {
	getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.EnumMember;
	}

	getTooltip(): string {
		return `(enum member) ${this.outer.getName()}.${this.getName()}`;
	}
}

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISimpleSymbol> {
	public extendsRef?: UCStructRef;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;

	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Module;
	}

	add(symbol: UCFieldSymbol) {
		symbol.outer = this;
		symbol.next = this.children;
		this.children = symbol;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}

			if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
				return this.extendsRef;
			}

			return this.getChildSymbolAtPos(position);
		}
		return undefined;
	}

	getChildSymbolAtPos(position: Position): UCSymbol | undefined {
		for (var child = this.children; child; child = child.next) {
			let innerSymbol = child.getSymbolAtPos(position);
			if (innerSymbol) {
				return innerSymbol;
			}
		}
		return undefined;
	}

	findChildSymbol(id: string): UCSymbol | undefined {
		id = id.toLowerCase();
		for (var child = this.children; child; child = child.next) {
			if (child.getName().toLowerCase() === id) {
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: string, deepSearch?: boolean): UCSymbol | undefined {
		for (let superSymbol: UCStructSymbol = this; superSymbol; superSymbol = superSymbol.super) {
			let symbol = superSymbol.findChildSymbol(id);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
		return undefined;
	}

	link(document: UCDocument) {
		if (this.extendsRef) {
			this.extendsRef.link(document);
			// Temp hack
			this.super = this.extendsRef.getReference() as UCStructSymbol;
		}

		for (var child = this.children; child; child = child.next) {
			child.link(document);
		}
	}
}

export class UCScriptStructSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Struct;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Struct;
	}

	getTooltip(): string {
		return `struct ${this.getName()}`;
	}
}

export class UCDefaultPropertySymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.Property;
	}
}

export class UCDefaultsSymbol extends UCStructSymbol {

}

export class UCFunctionSymbol extends UCStructSymbol {
	public returnTypeRef?: UCSymbolRef;
	public returnTypeSymbol?: UCSymbol;
	public params: UCPropertySymbol[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTooltip(): string {
		return '(method) ' + this.getName() + this.buildArguments() + this.buildReturnType();
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}

			if (this.returnTypeRef && this.returnTypeRef.getSymbolAtPos(position)) {
				return this.returnTypeRef;
			}

			return this.getChildSymbolAtPos(position);
		}
		return undefined;
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

export class UCStateSymbol extends UCStructSymbol {
	getKind(): SymbolKind {
		return SymbolKind.Namespace;
	}

	getTooltip(): string {
		return `state ${this.getName()}`;
	}
}

export class UCClassSymbol extends UCStructSymbol {
	public isLinked: boolean = false;
	public document: UCDocument;

	public withinRef?: UCSymbol;

	public replicatedNameTokens: Token[] = [];
	public replicatedSymbols?: UCSymbol[];

	public static visit(ctx: UCParser.ClassDeclContext): UCClassSymbol {
		var className = ctx.className();
		var symbol = new UCClassSymbol(
			{ name: className.text, range: rangeFromToken(className.start)},
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		var extendsCtx = ctx.classExtendsReference();
		if (extendsCtx) {
			symbol.extendsRef = new UCClassRef({
				name: extendsCtx.text,
				range: rangeFromTokens(extendsCtx.start, extendsCtx.stop)
			});
		}

		var withinCtx = ctx.classWithinReference();
		if (withinCtx) {
			symbol.withinRef = new UCClassRef({
				name: withinCtx.text,
				range: rangeFromTokens(withinCtx.start, withinCtx.stop)
			});
		}

		return symbol;
	}

	getKind(): SymbolKind {
		return SymbolKind.Class;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Class;
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

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}

			if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
				return this.extendsRef;
			}

			if (this.withinRef && this.withinRef.getSymbolAtPos(position)) {
				return this.withinRef;
			}
		} else {
			return this.getChildSymbolAtPos(position);
		}
		return undefined;
	}

	findSuperTypeSymbol(id: string, deepSearch: boolean): ISimpleSymbol | undefined {
		id = id.toLowerCase();
		var typeSymbol = this.document.classPackage.symbols.get(id);
		if (typeSymbol) {
			return typeSymbol;
		}

		typeSymbol = this.findSuperSymbol(id, deepSearch);
		if (typeSymbol instanceof UCScriptStructSymbol || typeSymbol instanceof UCEnumSymbol) {
			return typeSymbol;
		}
		return undefined;
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
			const errorNode = new SemanticErrorNode(
				this,
				`Class name '${className}' must be equal to its file name ${documentName}!`,
			);
			document.nodes.push(errorNode);
		}

		if (this.replicatedNameTokens) {
			this.replicatedSymbols = [];
			for (let nameToken of this.replicatedNameTokens) {
				let nameSymbol = new UCSymbolRef({ name: nameToken.text, range: rangeFromToken(nameToken) });

				// Only child symbols are replicated thus we can safely skip any super children.
				let symbol = this.findChildSymbol(nameToken.text);
				if (symbol) {
					symbol.linkLocation(Location.create(document.uri, rangeFromToken(nameToken)));
					this.replicatedSymbols.push(symbol);
					if (symbol instanceof UCPropertySymbol || symbol instanceof UCFunctionSymbol) {
						continue;
					} else {
						const errorNode = new SemanticErrorNode(
							nameSymbol,
							`Type of field '${symbol.getName()}' is not replicatable!`
						);
						document.nodes.push(errorNode);
					}
				} else {
					const errorNode = new SemanticErrorNode(
						nameSymbol,
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

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Reference;
	}

	getUri(): string | undefined {
		return undefined;
	}

	getTooltip(): string {
		return this.getName();
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
	new UCNativeSymbol('array'),
	new UCNativeSymbol('delegate')
];

// Holds class symbols, solely used for traversing symbols in a package.
export class UCPackage implements ISymbolContainer<ISimpleSymbol> {
	public outer = null;
	public symbols = new Map<string, ISimpleSymbol>();

	private name: string;

	constructor(uri: string) {
		this.name = path.basename(uri);
	}

	getName(): string {
		return this.name;
	}

	getKind(): SymbolKind {
		return SymbolKind.Package;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Module;
	}

	getUri(): string {
		throw new Error("getUri not implemented");
	}

	getTooltip(): string {
		return this.getName();
	}

	add(symbol: ISimpleSymbol) {
		symbol.outer = this;
		this.symbols.set(symbol.getName().toLowerCase(), symbol);
	}

	public findSuperSymbol(name: string, deepSearch?: boolean): ISimpleSymbol {
		name = name.toLowerCase();
		return this.symbols.get(name);
	}
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
			symbol.extendsRef = new UCStructRef({
				name: extendsCtx.text,
				range: rangeFromTokens(extendsCtx.start, extendsCtx.stop)
			});
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
			return new UCStructRef(
				{ name: structName.text, range: rangeFromTokens(structName.start, structName.stop) }
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
			const propSymbol = new UCPropertySymbol(
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

				const propSymbol = new UCPropertySymbol(
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
			symbol.extendsRef = new UCStateRef({
				name: extendsCtx.text,
				range: rangeFromTokens(extendsCtx.start, extendsCtx.stop)
			});
		}

		this.declare(symbol);
		this.push(symbol);
	}

	exitStateDecl(ctx: UCParser.StateDeclContext) {
		this.pop();
	}

	enterDefaultpropertiesBlock(ctx: UCParser.DefaultpropertiesBlockContext) {
		const nameCtx = ctx.kwDEFAULTPROPERTIES();
		const symbol = new UCDefaultsSymbol(
			{ name: nameCtx.text, range: rangeFromToken(nameCtx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
		this.declare(symbol);
		this.push(symbol);
	}

	enterDefaultProperty(ctx: UCParser.DefaultPropertyContext) {
		const idCtx = ctx.identifier();
		const symbol = new UCDefaultPropertySymbol(
			{ name: idCtx.text, range: rangeFromToken(ctx.start) },
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);
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

	constructor(text: string) {
		this.lexer = new UCGrammarLexer(new CaseInsensitiveStream(text));

		this.tokenStream = new CommonTokenStream(this.lexer);
		this.parser = new UCParser.UCGrammarParser(this.tokenStream);
		this.parser.buildParseTree = true;
	}

	parse(document: UCDocument) {
		this.parser.addErrorListener(document);
		let tree = this.parser.program();
		ParseTreeWalker.DEFAULT.walk(document, tree);
	}
}