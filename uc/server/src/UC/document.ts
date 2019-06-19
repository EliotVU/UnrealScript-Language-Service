import * as path from 'path';
import * as fs from 'fs';

import URI from 'vscode-uri';
import { Diagnostic, Position } from 'vscode-languageserver';
import { performance } from 'perf_hooks';

import { CommonTokenStream, ANTLRErrorListener } from 'antlr4ts';

import { UCGrammarLexer } from '../antlr/UCGrammarLexer';
import { UCGrammarParser } from '../antlr/UCGrammarParser';
import { connection } from '../server';

import { UCClassSymbol, ISymbol, ISymbolReference, UCPackage } from './Symbols';

import { IDiagnosticNode } from './diagnostics/diagnostics';
import { IndexedReferencesMap } from './indexer';

import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';
import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { DocumentASTWalker } from './documentASTWalker';

export class UCDocument {
	public readonly fileName: string;

	public nodes: IDiagnosticNode[] = [];
	public tokenStream: CommonTokenStream;

	public class?: UCClassSymbol;
	private readonly indexReferencesMade = new Map<string, ISymbolReference | ISymbolReference[]>();

	constructor(public readonly filePath: string, public classPackage: UCPackage) {
		this.fileName = path.basename(filePath, '.uc');
	}

	public getSymbolAtPos(position: Position): ISymbol | undefined {
		return this.class && this.class.getSymbolAtPos(position);
	}

	public build(text?: string) {
		connection.console.log('building document ' + this.fileName);

		if (this.class) {
			this.invalidate();
		}

		const startLexing = performance.now();
		const lexer = new UCGrammarLexer(new CaseInsensitiveStream(text || this.readText()));
		lexer.removeErrorListeners();
		lexer.addErrorListener(this as ANTLRErrorListener<number>);
		const stream = this.tokenStream = new CommonTokenStream(lexer);
		connection.console.info(this.fileName + ': lexing time ' + (performance.now() - startLexing));

		const startParsing = performance.now();
		const parser = new UCGrammarParser(stream);

		parser.errorHandler = ERROR_STRATEGY;
		connection.console.info(this.fileName + ': parsing time ' + (performance.now() - startParsing));
		parser.removeErrorListeners();

		const startWalking = performance.now();
		try {
			const walker = new DocumentASTWalker(this);
			parser.addErrorListener(walker);
			walker.visit(parser.program());
		} catch (err) {
			connection.console.error(`An error was thrown while walking document:\n "${this.filePath}", "${err.stack}"`);
		} finally {
			connection.console.info(this.fileName + ': Walking time ' + (performance.now() - startWalking));
		}
	}

	private readText(): string {
		const filePath = URI.parse(this.filePath).fsPath;
		const text = fs.readFileSync(filePath).toString();
		return text;
	}

	public link() {
		const start = performance.now();
		this.class!.index(this, this.class!);
		connection.console.info(this.fileName + ': linking time ' + (performance.now() - start));
	}

	private invalidate() {
		delete this.class;
		this.nodes = []; // clear

		// Clear all the indexed references that we have made.
		for (let [key, value] of this.indexReferencesMade) {
			const indexedRefs = IndexedReferencesMap.get(key);
			if (!indexedRefs) {
				return;
			}

			if (value instanceof Array) {
				value.forEach(ref => indexedRefs.delete(ref));
			} else {
				indexedRefs.delete(value);
			}

			if (indexedRefs.size === 0) {
				IndexedReferencesMap.delete(key);
			}
		}

		this.indexReferencesMade.clear();
	}

	public analyze(): Diagnostic[] {
		if (!this.class) {
			return [];
		}

		const start = performance.now();
		this.class!.analyze(this, this.class);
		connection.console.info(this.fileName + ': analyzing time ' + (performance.now() - start));

		const nodes = this.getNodes();
		this.nodes = [];
		return nodes;
	}

	private getNodes() {
		return this.nodes
			.map(node => {
				return Diagnostic.create(
					node.getRange(),
					node.toString(),
					undefined,
					undefined,
					'unrealscript'
				);
			});
	}

	indexReference(symbol: ISymbol, ref: ISymbolReference) {
		const key = symbol.getQualifiedName();

		let value = this.indexReferencesMade.get(key);
		if (value) {
			if (value instanceof Array) {
				value.push(ref);
			} else {
				this.indexReferencesMade.set(key, [value, ref]);
			}
		} else {
			this.indexReferencesMade.set(key, ref);
		}

		// TODO: Refactor this, we are pretty much duplicating this function's job.
		const gRefs = IndexedReferencesMap.get(key) || new Set<ISymbolReference>();
		gRefs.add(ref);
		IndexedReferencesMap.set(key, gRefs);
	}
}