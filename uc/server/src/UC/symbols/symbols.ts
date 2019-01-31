import { Range, SymbolKind, CompletionItemKind, Location, Position } from 'vscode-languageserver-types';

import { Token } from 'antlr4ts';

import { SemanticErrorNode, UnrecognizedTypeNode } from '../diagnostics/diagnostics';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCSymbol } from './UCSymbol';
import { UCDocumentListener } from '../DocumentListener';
import { CORE_PACKAGE } from './NativeSymbols';

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
			return this.reference.getTooltip();
		}
		return super.getTooltip();
	}

	setReference(symbol: ISimpleSymbol) {
		this.reference = symbol;
		if (symbol && symbol instanceof UCSymbol) {
			symbol.registerReference(Location.create(this.getUri(), this.getIdRange()));
		}
	}

	getReference(): ISimpleSymbol | undefined {
		return this.reference;
	}

	getReferencedLocations(): Location[] | undefined {
		var ref = this.getReference();
		return ref instanceof UCSymbol
			? ref.getReferencedLocations()
			: super.getReferencedLocations();
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

	constructor(id: ISymbolId, outer: ISimpleSymbol, private _expectingType?: UCType, private span?: ISymbolSpan) {
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

	getSpanRange(): Range {
		return this.span!.range;
	}

	isWithinPosition(position: Position) {
		const range = this.getSpanRange();
		if (position.line < range.start.line || position.line > range.end.line) {
			return false;
		}

		if (position.line == range.start.line) {
			return position.character >= range.start.character;
		}

		if (position.line == range.end.line) {
			return position.character <= range.end.character;
		}
		return false;
	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.span) {
			return super.getSymbolAtPos(position);
		}

		if (this.isWithinPosition(position)) {
			if (this.isIdWithinPosition(position)) {
				return this;
			}
			return this.getSubSymbolAtPos(position);
		}
		return undefined;
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.InnerTypeRef) {
			return this.InnerTypeRef.getSymbolAtPos(position);
		}
		return undefined;
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		// console.assert(this.outer, 'No outer for type "' + this.getName() + '"');

		switch (this._expectingType) {
			case UCType.Class:
				this.linkToClass(document);
				break;

			default:
				const symbol = context.findTypeSymbol(this.getName().toLowerCase(), true);
				if (symbol) {
					this.setReference(symbol);
				} else {
					this.linkToClass(document);
				}
				break;
		}

		if (this.InnerTypeRef) {
			this.InnerTypeRef.link(document, context);
		}
	}

	private linkToClass(document: UCDocumentListener) {
		document.getDocument(this.getName().toLowerCase(), (classDocument => {
			if (classDocument && classDocument.class) {
				this.setReference(classDocument.class);
			} else {
				document.nodes.push(new UnrecognizedTypeNode(this));
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

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.isWithinPosition(position)) {
			return undefined;
		}

		if (this.isIdWithinPosition(position)) {
			return this;
		}
		return this.getSubSymbolAtPos(position);
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
	public typeRef: UCTypeRef;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Property;
	}

	getTypeTooltip(): string {
		return '(variable)';
	}

	getTooltip(): string {
		return `${this.getTypeTooltip()} ${this.getTypeText()} ${this.getQualifiedName()}`;
	}

	getTypeText(): string {
		return this.typeRef!.getName();
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.typeRef) {
			return this.typeRef.getSymbolAtPos(position);
		}
		return undefined;
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
		super.link(document);

		if (this.typeRef) {
			this.typeRef.link(document, context);
		}
	}
}

export class UCParamSymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
	}

	getTypeTooltip(): string {
		return '(parameter)';
	}
}

export class UCLocalSymbol extends UCPropertySymbol {
	getKind(): SymbolKind {
		return SymbolKind.Variable;
	}

	getCompletionItemKind(): CompletionItemKind {
		return CompletionItemKind.Variable;
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

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
			return this.extendsRef;
		}
		return this.getChildSymbolAtPos(position);
	}

	getChildSymbolAtPos(position: Position): UCSymbol | undefined {
		for (let child = this.children; child; child = child.next) {
			const innerSymbol = child.getSymbolAtPos(position);
			if (innerSymbol) {
				return innerSymbol;
			}
		}
		return undefined;
	}

	addSymbol(symbol: UCFieldSymbol) {
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

	findSymbol(id: string): UCSymbol | undefined {
		id = id.toLowerCase();
		for (let child = this.children; child; child = child.next) {
			if (child.getName().toLowerCase() === id) {
				return child;
			}
		}
		return undefined;
	}

	findSuperSymbol(id: string, deepSearch?: boolean): UCSymbol | undefined {
		for (let superSymbol: UCStructSymbol = this; superSymbol; superSymbol = superSymbol.super) {
			const symbol = superSymbol.findSymbol(id);
			if (symbol) {
				return symbol;
			}

			if (!deepSearch) {
				break;
			}
		}
		return undefined;
	}

	findTypeSymbol(idLowerCase: string, deepSearch: boolean): ISimpleSymbol | undefined {
		// Quick shortcut for the most common types.
		var predefinedType: ISimpleSymbol = CORE_PACKAGE.findQualifiedSymbol(idLowerCase, false);
		if (predefinedType) {
			return predefinedType;
		}

		if (this.types) {
			const typeSymbol = this.types.get(idLowerCase);
			if (typeSymbol) {
				return typeSymbol;
			}
		}

		if (!deepSearch) {
			return undefined;
		}

		if (this.super) {
			return this.super.findTypeSymbol(idLowerCase, deepSearch);
		}

		return super.findTypeSymbol(idLowerCase, deepSearch);
	}

	link(document: UCDocumentListener, context: UCStructSymbol) {
		if (this.extendsRef) {
			this.extendsRef.link(document, context);
			// Ensure that we don't overwrite super assignment from our descendant class.
			if (!this.super) {
				this.super = this.extendsRef.getReference() as UCStructSymbol;
			}
		}

		if (this.types) {
			for (let type of this.types.values()) {
				type.link(document, this);
			}
		}

		for (let child = this.children; child; child = child.next) {
			if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
				continue;
			}

			child.link(document, this);
		}
	}

	analyze(document: UCDocumentListener, _context: UCStructSymbol) {
		if (this.types) {
			for (let type of this.types.values()) {
				type.analyze(document, this);
			}
		}

		for (let child = this.children; child; child = child.next) {
			if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
				continue;
			}

			child.analyze(document, this);
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

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.returnTypeRef && this.returnTypeRef.getSymbolAtPos(position)) {
			return this.returnTypeRef;
		}
		return super.getSubSymbolAtPos(position);
	}

	public link(document: UCDocumentListener, context: UCStructSymbol) {
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
	public document?: UCDocumentListener;

	public withinRef?: UCTypeRef;
	public replicatedFieldRefs?: UCSymbolRef[];

	public within?: UCClassSymbol;

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
			return this.getSubSymbolAtPos(position);
		}
		// TODO: Optimize
		if (this.replicatedFieldRefs) {
			for (let ref of this.replicatedFieldRefs) {
				if (ref.getSymbolAtPos(position)) {
					return ref;
				}
			}
		}
		// HACK: due the fact that a class doesn't enclose its symbols we'll have to check for child symbols regardless if the given position is within the declaration span.
		return this.getChildSymbolAtPos(position);
	}

	getSubSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.extendsRef && this.extendsRef.getSymbolAtPos(position)) {
			return this.extendsRef;
		}

		if (this.withinRef && this.withinRef.getSymbolAtPos(position)) {
			return this.withinRef;
		}

		// NOTE: Never call super, see HACK above.
		return undefined;
	}

	link(document: UCDocumentListener, context: UCClassSymbol = document.class) {
		this.document = document;
		if (this.withinRef) {
			this.withinRef.link(document, context);

			// Overwrite extendsRef super, we inherit from the within class instead.
			this.super = this.withinRef.getReference() as UCClassSymbol;
		}
		super.link(document, context);
	}

	analyze(document: UCDocumentListener, context: UCStructSymbol) {
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
				let symbol = this.findSymbol(symbolRef.getName());
				if (!symbol) {
					const errorNode = new SemanticErrorNode(
						symbolRef,
						`Variable or Function '${symbolRef.getName()}' does not exist in class '${className}'.`
					);
					document.nodes.push(errorNode);
					continue;
				}

				symbolRef.setReference(symbol);
				if (symbol instanceof UCPropertySymbol || symbol instanceof UCFunctionSymbol) {
					continue;
				}

				const errorNode = new SemanticErrorNode(
					symbolRef,
					`Type of field '${symbol.getName()}' is not replicatable!`
				);
				document.nodes.push(errorNode);
			}
		}
		super.analyze(document, context);
	}
}