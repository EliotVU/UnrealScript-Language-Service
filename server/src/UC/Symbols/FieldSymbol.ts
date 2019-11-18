import { Range, Position, Location } from 'vscode-languageserver-types';

import { intersectsWith, intersectsWithRange } from '../helpers';
import { UCDocument } from '../document';

import { Identifier, ISymbol, UCSymbol, UCStructSymbol, UCTypeFlags, ITypeSymbol } from '.';
import { ISymbolReference } from './ISymbol';

export enum FieldModifiers {
	None 				= 0x0000,
	Protected 			= 0x0001,
	Private 			= 0x0002,
	Native 				= 0x0004,
	Const 				= 0x0008,
	NotPublic 			= Protected | Private
}

export abstract class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;
	public containingStruct?: UCStructSymbol;

	public modifiers: FieldModifiers = FieldModifiers.None;

	constructor(id: Identifier, private readonly range: Range = id.range) {
		super(id);
	}

	getRange(): Range {
		return this.range;
	}

	getType(): ITypeSymbol | undefined {
		return undefined;
	}

	protected getTypeKeyword(): string | undefined {
		return undefined;
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

	isPublic(): boolean {
		return (this.modifiers & FieldModifiers.NotPublic) === 0;
	}

	isPrivate(): boolean {
		return (this.modifiers & FieldModifiers.Private) !== 0;
	}

	isProtected(): boolean {
		return (this.modifiers & FieldModifiers.Protected) !== 0;
	}

	isConst(): boolean {
		return (this.modifiers & FieldModifiers.Const) !== 0;
	}

	isNative(): boolean {
		return (this.modifiers & FieldModifiers.Native) !== 0;
	}

	acceptCompletion(_document: UCDocument, _context: ISymbol): boolean {
		// // TODO: Does not match the language's behavior yet!
		// if (this.isPrivate()) {
		// 	return this.getOuter<UCClassSymbol>() === _document.class;
		// }
		// return this.isPublic();
		return true;
	}

	index(document: UCDocument, _context: UCStructSymbol) {
		this.indexDeclaration(document);
	}

	private indexDeclaration(document: UCDocument) {
		const ref: ISymbolReference = {
			location: Location.create(document.filePath, this.id.range),
			inAssignment: true
		};
		document.indexReference(this, ref);
	}

	protected buildModifiers(): string[] {
		const text: string[] = [];

		if (this.isNative()) {
			text.push('native');
		}

		if (this.isProtected()) {
			text.push('protected');
		}
		else if (this.isPrivate()) {
			text.push('private');
		}

		if (this.isConst()) {
			text.push('const');
		}

		return text;
	}
}