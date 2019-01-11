import * as path from 'path';

import { Range, SymbolKind, CompletionItemKind, Location, Position } from 'vscode-languageserver-types';

import { Token } from 'antlr4ts';

import * as UCParser from '../../antlr/UCGrammarParser';

import { SemanticErrorNode } from '../diagnostics/diagnostics';
import { ISimpleSymbol } from './ISimpleSymbol';
import { ISymbolContainer } from './ISymbolContainer';
import { UCSymbol } from './UCSymbol';
import { UCDocument, rangeFromToken, rangeFromTokens } from '../UCDocument';

export interface ISymbolId {
	name: string;
	range: Range;
}

export interface ISymbolOffset {
	range: Range;
}

/**
 * For general symbol references, like a function's return type which cannot yet be identified.
 */
export class UCSymbolRef extends UCSymbol {
	protected hasBeenLinked?: boolean;
	protected reference?: ISimpleSymbol;

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

export class UCTypeRef extends UCSymbolRef {
	public InnerTypeRef?: UCTypeRef;

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
				classDoc.class.addReference(Location.create(document.uri, this.getIdRange()));
				classDoc.class.document = classDoc; // temp hack
				classDoc.class.link(classDoc);
			} else {
				document.nodes.push(new SemanticErrorNode(this, `Type '${this.getName()}' not found!`));
			}
		}
		else if (this.reference instanceof UCSymbol) {
			this.reference.addReference(Location.create(document.uri, this.getIdRange()));
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
			classDoc.class.addReference(Location.create(document.uri, this.getIdRange()));
			classDoc.class.document = classDoc; // temp hack
			classDoc.class.link(classDoc);
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
		return this.getQualifiedName();
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

	getTooltip(): string {
		if (this.typeRef) {
			return `(variable) ${this.getTypeText()} ${this.getQualifiedName()}`;
		}
		return '(variable) ' + this.getQualifiedName();
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

	getTooltip(): string {
		return `(enum member) ${this.getQualifiedName()}`;
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
		return `struct ${this.getQualifiedName()}`;
	}
}

export class UCDefaultVariableSymbol extends UCFieldSymbol {
	public varRef?: UCSymbolRef;

	getKind(): SymbolKind {
		return SymbolKind.Property;
	}

	getTooltip(): string {
		return '(default) ' + this.getName();
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

	getTooltip(): string {
		return '(method) ' + this.buildReturnType() + this.getQualifiedName() + this.buildArguments();
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
	public isLinked: boolean = false;
	public document: UCDocument;

	public withinRef?: UCSymbol;

	public replicatedNameTokens: Token[] = [];

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
			return this.getChildSymbolAtPos(position);
		}
		return undefined;
	}

	findSuperTypeSymbol(id: string, deepSearch: boolean): ISimpleSymbol | undefined {
		id = id.toLowerCase();
		var typeSymbol = this.document.classPackage.findSuperSymbol(id, deepSearch);
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
			for (let nameToken of this.replicatedNameTokens) {
				let nameSymbol = new UCSymbolRef({ name: nameToken.text, range: rangeFromToken(nameToken) });

				// Only child symbols are replicated thus we can safely skip any super children.
				let symbol = this.findChildSymbol(nameToken.text);
				if (symbol) {
					symbol.addReference(Location.create(document.uri, rangeFromToken(nameToken)));
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