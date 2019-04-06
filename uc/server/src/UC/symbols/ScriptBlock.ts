import { Position, Range } from 'vscode-languageserver';

import { intersectsWith } from '../helpers';
import { UCDocument } from '../DocumentListener';

import { UCSymbol, UCStructSymbol } from '.';
import { IStatement } from './Statements';

export class UCScriptBlock {
	public statements?: IStatement[];

	constructor(private range?: Range) {

	}

	getSymbolAtPos(position: Position): UCSymbol | undefined {
		if (!intersectsWith(this.range, position)) {
			return undefined;
		}
		const symbol = this.getContainedSymbolAtPos(position);
		return symbol;
	}

	getContainedSymbolAtPos(position: Position): UCSymbol | undefined {
		if (this.statements) for (let statement of this.statements) if (statement) {
			const symbol = statement.getSymbolAtPos(position);
			if (symbol) {
				return symbol;
			}
		}
	}

	index(document: UCDocument, context: UCStructSymbol) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			statement.index(document, context);
		}
	}

	analyze(document: UCDocument, context: UCStructSymbol) {
		if (this.statements) for (let statement of this.statements) if (statement) {
			statement.analyze(document, context);
		}
	}
}