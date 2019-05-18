import { Range, Position, Location } from 'vscode-languageserver-types';

import { intersectsWith } from '../helpers';
import { UCDocument } from '../DocumentListener';

import { ISymbol, UCSymbol, UCStructSymbol, UCClassSymbol } from '.';

export abstract class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;
	public containingStruct?: UCStructSymbol;

	constructor(private name: string, nameRange?: Range, private spanRange?: Range) {
		super(nameRange);
	}

	getName(): string {
		return this.name;
	}

	getTooltip(): string {
		return this.getQualifiedName();
	}

	getSpanRange(): Range {
		return this.spanRange;
	}

	getSymbolAtPos(position: Position): UCSymbol {
		if (!intersectsWith(this.getSpanRange(), position)) {
			return undefined;
		}

		if (this.intersectsWithName(position)) {
			return this;
		}
		return this.getContainedSymbolAtPos(position);
	}

	getCompletionContext(_position: Position): UCSymbol {
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
		this.indexReference(document, {
			location: Location.create(document.uri, this.getNameRange()),
			symbol: this,
			context: {
				inAssignment: true
			}
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