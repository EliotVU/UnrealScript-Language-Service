import { Range, Position, Location } from 'vscode-languageserver-types';

import { intersectsWith, intersectsWithRange } from '../helpers';
import { UCDocument } from '../document';

import { Identifier, ISymbol, UCSymbol, UCStructSymbol, UCClassSymbol } from '.';

export abstract class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;
	public containingStruct?: UCStructSymbol;

	constructor(id: Identifier, private readonly range: Range = id.range) {
		super(id);
	}

	getRange(): Range {
		return this.range;
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getSymbolAtPos(position: Position) {
		if (!intersectsWith(this.getRange(), position)) {
			return undefined;
		}

		if (intersectsWithRange(position, this.id.range)) {
			return this;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getCompletionContext(_position: Position): ISymbol | undefined {
		return this;
	}

	// TODO: reflect parsed modifier.
	isPublic(): boolean {
		return true;
	}

	// TODO: reflect parsed modifier.
	isPrivate(): boolean {
		return false;
	}

	// TODO: reflect parsed modifier.
	isProtected(): boolean {
		return false;
	}

	// TODO: reflect parsed modifier.
	isConst(): boolean {
		return false;
	}

	// TODO: reflect parsed modifier.
	isNative(): boolean {
		return false;
	}

	// Returns true if this is a symbol that declares a type like a struct or enum.
	isType(): boolean {
		return false;
	}

	acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		// TODO: Does not match the language's behavior yet!
		if (this.isPrivate()) {
			return this.getOuter<UCClassSymbol>() === _document.class;
		}
		return this.isPublic();
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		this.indexDeclaration(document);
	}

	private indexDeclaration(document: UCDocument) {
		document.indexReference(this, {
			location: Location.create(document.filePath, this.id.range),
			symbol: this,
			context: { inAssignment: true }
		});
	}

	protected buildModifiers(): string[] {
		let text: string[] = [];

		if (this.isConst()) {
			text.push('const');
		}

		if (this.isNative()) {
			text.push('native');
		}

		return text;
	}
}