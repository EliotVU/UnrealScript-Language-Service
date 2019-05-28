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
import { IndexedReferences } from './indexer';

import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';
import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { DocumentASTWalker } from './documentASTWalker';

export class UCDocument {
	public readonly fileName: string;

	public nodes: IDiagnosticNode[] = [];
	public tokenStream: CommonTokenStream;

	public class?: UCClassSymbol;
	private readonly indexReferencesMade = new Map<string, Set<ISymbolReference>>();

	constructor(public classPackage: UCPackage, public readonly uri: string) {
		this.fileName = path.basename(uri, '.uc');
	}

	indexReference(symbol: ISymbol, ref: ISymbolReference) {
		const key = symbol.getQualifiedName();

		const refs = this.indexReferencesMade.get(key) || new Set<ISymbolReference>();
		refs.add(ref);

		this.indexReferencesMade.set(key, refs);

		// TODO: Refactor this, we are pretty much duplicating this function's job.
		const indexedRefs = IndexedReferences.get(key) || new Set<ISymbolReference>();
		indexedRefs.add(ref);
		IndexedReferences.set(key, indexedRefs);
	}

	parse(text?: string) {
		const startParsing = performance.now();
		connection.console.log('parsing document ' + this.fileName);

		const lexer = new UCGrammarLexer(new CaseInsensitiveStream(text || this.readText()));
		lexer.removeErrorListeners();
		lexer.addErrorListener(this as ANTLRErrorListener<number>);

		const stream = this.tokenStream = new CommonTokenStream(lexer);
		const parser = new UCGrammarParser(stream);
		parser.errorHandler = ERROR_STRATEGY;
		parser.removeErrorListeners();
		connection.console.log(this.fileName + ': parsing time ' + (performance.now() - startParsing));

		const startWalking = performance.now();
		try {
			const walker = new DocumentASTWalker(this);
			parser.addErrorListener(walker);
			walker.visitProgram(parser.program());
		} catch (err) {
			console.error('Error walking document', this.uri, err);
		}
		finally {
			connection.console.log(this.fileName + ': Walking time ' + (performance.now() - startWalking));
		}
	}

	readText(): string {
		const filePath = URI.parse(this.uri).fsPath;
		const text = fs.readFileSync(filePath).toString();
		return text;
	}

	link() {
		const start = performance.now();
		this.class!.index(this, this.class!);
		connection.console.log(this.fileName + ': linking time ' + (performance.now() - start));
	}

	invalidate() {
		delete this.class;
		this.nodes = []; // clear

		// Clear all the indexed references that we have made.
		for (let [key, value] of this.indexReferencesMade) {
			const indexedRefs = IndexedReferences.get(key);
			if (!indexedRefs) {
				return;
			}

			value.forEach(ref => indexedRefs.delete(ref));

			if (indexedRefs.size === 0) {
				IndexedReferences.delete(key);
			}
		}

		this.indexReferencesMade.clear();
	}

	analyze(): Diagnostic[] {
		if (!this.class) {
			return [];
		}

		const start = performance.now();
		this.class!.analyze(this, this.class);
		connection.console.log(this.fileName + ': analyzing time ' + (performance.now() - start));
		return this.getNodes();
	}

	getNodes() {
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

	getSymbolAtPos(position: Position): ISymbol | undefined {
		return this.class && this.class.getSymbolAtPos(position);
	}
}