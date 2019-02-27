import { Range, Position } from 'vscode-languageserver-types';

import { UCSymbol } from './';

export class UCFieldSymbol extends UCSymbol {
	public next?: UCFieldSymbol;

	constructor(private name: string, nameRange: Range, private spanRange: Range) {
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

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!this.intersectsWith(position)) {
			return undefined;
		}

		if (this.intersectsWithName(position)) {
			return this;
		}
		return this.getSubSymbolAtPos(position);
	}
}