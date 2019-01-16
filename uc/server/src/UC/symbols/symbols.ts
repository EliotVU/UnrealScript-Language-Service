import { Range, SymbolKind, CompletionItemKind, Location, Position } from 'vscode-languageserver-types';

import { Token } from 'antlr4ts';

import * as UCParser from '../../antlr/UCGrammarParser';

import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCSymbol } from './UCSymbol';
import { UCDocument, rangeFromToken, rangeFromTokens, visitExtendsClause } from '../UCDocument';

export interface ISymbolId {
	text: string;
	range: Range;
}

export interface ISymbolSpan {
	range: Range;

	// TODO: Add offset? For high-performance cursor position tracking.
}

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolRef extends UCSymbol {
	protected reference?: ISimpleSymbol;

	constructor(id: ISymbolId, outer: ISimpleSymbol) {
		super(id);
		this.outer = outer;
	}

	getTooltip(): string {
		if (this.reference) {
			return this.reference.getQualifiedName();
		}
		return super.getTooltip();
	}

	getReferences(): Location[] | undefined {
		var ref = this.getReference();
		return ref instanceof UCSymbol ? ref.getReferences() : super.getReferences();
	}

	setReference(symbol: ISimpleSymbol) {
		this.reference = symbol;
	}

	getReference(): ISimpleSymbol | undefined {
		return this.reference;
	}
}

export enum UCType {
	Class,
	Enum,
	Struct,
	State,
	Function
}

export class UCTypeRef extends UCSymbolRef {
	public InnerTypeRef?: UCTypeRef;

	constructor(id: ISymbolId, outer: ISimpleSymbol, private _expectingType?: UCType) {
		super(id, outer);
	}

	getTooltip(): string {
		if (this.reference) {
			return this.InnerTypeRef
				? (this.reference.getQualifiedName() + `<${this.InnerTypeRef.getTooltip()}>`)
				: this.reference.getQualifiedName();
		}
		return this.getName();
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

	link(document: UCDocument, context: UCStructSymbol) {
		if (!this.getName()) {
			return;
		}

		switch (this._expectingType) {
			case UCType.Class:
				this.linkToClass(document);
				break;

			default:
				this.reference = context.findSuperTypeSymbol(this.getName().toLowerCase(), true);
				if (!this.reference) {
					this.linkToClass(document);
				}
				break;
		}

		if (this.reference instanceof UCSymbol) {
			this.reference.addReference(Location.create(document.uri, this.getIdRange()));
		}

		if (this.InnerTypeRef) {
			this.InnerTypeRef.link(document, context);
		}
	}

	private linkToClass(document: UCDocument) {
		document.getDocument(this.getName(), (classDocument => {
			if (classDocument) {
				this.setReference(classDocument.class);
				classDocument.class.addReference(Location.create(document.uri, this.getIdRange()));
				classDocument.class.document = classDocument; // temp hack
				classDocument.link(classDocument);
			} else {
				document.nodes.push(new SemanticErrorNode(this, `Type '${this.getName()}' not found!`));
			}
		}));
	}
}

export class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;

	constructor(id: ISymbolId, private span: ISymbolSpan) {
		super(id);
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getSpanRange(): Range {
		return this.span.range;
	}

	isWithinPosition(position: Position) {
		var range = this.getSpanRange();
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
		return '(const) ' + this.getQualifiedName() + ' : ' + this.valueToken.text;
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

	getTypeTooltip(): string {
		return '(variable)';
	}

	getTooltip(): string {
		if (this.typeRef) {
			return `${this.getTypeTooltip()} ${this.getTypeText()} ${this.getQualifiedName()}`;
		}
		return this.getTypeTooltip() + ' ' + this.getQualifiedName();
	}

	getTypeText(): string {
		return this.typeRef.getName();
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

	public link(document: UCDocument, context: UCStructSymbol) {
		super.link(document);

		if (this.typeRef) {
			this.typeRef.link(document, context);
		}
	}
}

export class UCParamSymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.TypeParameter;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.TypeParameter;
	}

	getTypeTooltip(): string {
		return '(parameter)';
	}
}

export class UCLocalSymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.TypeParameter;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.TypeParameter;
	}

	getTypeTooltip(): string {
		return '(local)';
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
		return `enum ${this.getQualifiedName()}`;
	}
}

export class UCEnumMemberSymbol extends UCSymbol {
	getKind(): SymbolKind {
		return SymbolKind.EnumMember;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.EnumMember;
	}

	getTypeTooltip(): string {
		return '(enum member)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.getQualifiedName()}`;
	}
}

export class UCStructSymbol extends UCFieldSymbol implements ISymbolContainer<ISimpleSymbol> {
	public extendsRef?: UCTypeRef;
	public super?: UCStructSymbol;
	public children?: UCFieldSymbol;

	public types?: Map<string, UCFieldSymbol>;

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

		if (symbol instanceof UCScriptStructSymbol || symbol instanceof UCEnumSymbol) {
			if (!this.types) {
				this.types = new Map();
			}
			this.types.set(symbol.getName().toLowerCase(), symbol);
		}
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

	findSuperTypeSymbol(idLowerCase: string, deepSearch: boolean): ISimpleSymbol | undefined {
		if (this.types) {
			var typeSymbol = this.types.get(idLowerCase);
			if (typeSymbol) {
				return typeSymbol;
			}
		}

		if (!deepSearch) {
			return undefined;
		}

		if (this.super) {
			return this.super.findSuperTypeSymbol(idLowerCase, deepSearch);
		}

		return super.findSuperTypeSymbol(idLowerCase, deepSearch);
	}

	link(document: UCDocument, context: UCStructSymbol) {
		if (this.extendsRef) {
			this.extendsRef.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsRef.getReference() as UCStructSymbol;
			}
		}

		if (this.types) {
			for (var type of this.types.values()) {
				type.link(document, context);
			}
		}

		for (var child = this.children; child; child = child.next) {
			if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
				continue;
			}

			child.link(document, context);
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
		return `struct ${this.getQualifiedName()}`;
	}
}

export class UCDefaultVariableSymbol extends UCFieldSymbol {
	public varRef?: UCSymbolRef;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getTypeTooltip(): string {
		return '(default)';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + ' ' + this.getName();
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.isWithinPosition(position)) {
			if (this.varRef) {
				let symbol = this.varRef.getSymbolAtPos(position);
				if (symbol) {
					return symbol;
				}
			}

			if (this.isIdWithinPosition(position)) {
				return this;
			}

			// TODO check for sub defaults (e.g. in a struct literal)
		}
		return undefined;
	}

	public link(document: UCDocument) {
		if (this.varRef) {
			// HACK: We don't want to look up a symbol in our own container as that would return ourselves.
			var outer: UCStructSymbol = this.outer.outer as UCStructSymbol;
			if (!outer) {
				return;
			}

			var symbol = outer.findSuperSymbol(this.getName(), true);
			if (!symbol) {
				document.nodes.push(new SemanticErrorNode(this, `Variable '${this.getName()}' not found!`));
				return;
			}

			if (!(symbol instanceof UCPropertySymbol)) {
				const errorNode = new SemanticErrorNode(
					this,
					`Type of '${symbol.getName()}' cannot be assigned a default value!`,
				);
				document.nodes.push(errorNode);
			}

			this.varRef.setReference(symbol);
			symbol.addReference(Location.create(document.uri, this.getIdRange()));
		}
	}
}

/**
 * Can represent either a subobject aka archetype, or an instance of a defaultproperties declaration.
 */
export class UCObjectSymbol extends UCStructSymbol {
	getTooltip(): string {
		return this.getName();
	}
}

export class UCFunctionSymbol extends UCStructSymbol {
	public returnTypeRef?: UCSymbolRef;
	public params: UCPropertySymbol[] = [];

	getKind(): SymbolKind {
		return SymbolKind.Function;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Function;
	}

	getTypeTooltip(): string {
		return '(method)';
	}

	getTooltip(): string {
		return this.getTypeTooltip() + ' ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
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

	public link(document: UCDocument, context: UCStructSymbol) {
		super.link(document, context);

		if (this.returnTypeRef) {
			this.returnTypeRef.link(document, context);
		}
	}

	private buildReturnType(): string {
		return this.returnTypeRef ? this.returnTypeRef.getName() + ' ' : '';
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
		return `state ${this.getQualifiedName()}`;
	}
}

export class UCClassSymbol extends UCStructSymbol {
	public document?: UCDocument;

	public withinRef?: UCTypeRef;
	public replicatedFieldRefs?: UCSymbolRef[];

	public within?: UCClassSymbol;

	public static visit(ctx: UCParser.ClassDeclContext): UCClassSymbol {
		var className = ctx.className();
		var symbol = new UCClassSymbol(
			{ text: className.text, range: rangeFromToken(className.start)},
			{ range: rangeFromTokens(ctx.start, ctx.stop) }
		);

		var extendsCtx = ctx.extendsClause();
		if (extendsCtx) {
			symbol.extendsRef = visitExtendsClause(extendsCtx, UCType.Class);
		}

		var withinCtx = ctx.withinClause();
		if (withinCtx) {
			symbol.withinRef = visitExtendsClause(withinCtx, UCType.Class);
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
		return `class ${this.getQualifiedName()}`;
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
			// TODO: Optimize
			if (this.replicatedFieldRefs) {
				for (let ref of this.replicatedFieldRefs) {
					if (ref.getSymbolAtPos(position)) {
						return ref;
					}
				}
			}
			return this.getChildSymbolAtPos(position);
		}
		return undefined;
	}

	link(document: UCDocument, context: UCClassSymbol = document.class) {
		this.document = document;
		if (this.withinRef) {
			this.withinRef.link(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinRef.getReference() as UCClassSymbol;
		}
		super.link(document, context);

		const className = this.getName();
		if (className.toLowerCase() != document.name.toLowerCase()) {
			const errorNode = new SemanticErrorNode(
				this,
				`Class name '${className}' must be equal to its file name ${document.name}!`,
			);
			document.nodes.push(errorNode);
		}

		if (this.replicatedFieldRefs) {
			for (let symbolRef of this.replicatedFieldRefs) {
				// ref.link(document);
				let symbol = this.findChildSymbol(symbolRef.getName());
				if (!symbol) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable '${symbolRef.getName()}' does not exist in class '${className}'.`
					);
					document.nodes.push(errorNode);
					continue;
				}

				symbolRef.setReference(symbol);
				symbol.addReference(Location.create(document.uri, symbolRef.getIdRange()));
				if (symbol instanceof UCPropertySymbol || symbol instanceof UCFunctionSymbol) {
					continue;
				} else {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Type of field '${symbol.getName()}' is not replicatable!`
					);
					document.nodes.push(errorNode);
				}
			}
		}
	}
}