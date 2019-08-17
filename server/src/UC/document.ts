import { Subject } from 'rxjs';

import * as path from 'path';
import * as fs from 'fs';

import URI from 'vscode-uri';
import { Diagnostic, Position } from 'vscode-languageserver';
import { performance } from 'perf_hooks';
import { UCLexer } from '../antlr/UCLexer';
import { UCParser } from '../antlr/UCParser';
import { UCPreprocessorParser, MacrosContext } from '../antlr/UCPreprocessorParser';
import { CommonTokenStream, ANTLRErrorListener, BailErrorStrategy } from 'antlr4ts';
import { PredictionMode } from 'antlr4ts/atn/PredictionMode';
import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';

import { UCClassSymbol, ISymbol, ISymbolReference, UCPackage, UCSymbol } from './Symbols';

import { IDiagnosticNode, DiagnosticCollection } from './diagnostics/diagnostic';
import { DocumentAnalyzer } from './diagnostics/documentAnalyzer';
import { IndexedReferencesMap, config } from './indexer';

import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { DocumentASTWalker } from './documentASTWalker';

export const documentLinked$ = new Subject<UCDocument>();

export class UCDocument {
	/** Parsed file name filtered of path and extension. */
	public readonly fileName: string;

	public nodes: IDiagnosticNode[] = [];
	public tokenStream: CommonTokenStream;

	public macroTree: MacrosContext;

	public class?: UCClassSymbol;
	private readonly indexReferencesMade = new Map<string, ISymbolReference | ISymbolReference[]>();

	constructor(public readonly filePath: string, public classPackage: UCPackage) {
		this.fileName = path.basename(filePath, '.uc');
	}

	public getSymbolAtPos(position: Position): ISymbol | undefined {
		return this.class && this.class.getSymbolAtPos(position);
	}

	public build(text?: string) {
		console.log('building document ' + this.fileName);

		if (this.class) {
			this.invalidate();
		}

		const walker = new DocumentASTWalker(this);
		const stream = new CaseInsensitiveStream(text || this.readText());
		const lexer = new UCLexer(stream);
		lexer.removeErrorListeners(); lexer.addErrorListener(walker as ANTLRErrorListener<Number>);

		const tokenStream = this.tokenStream = new CommonTokenStream(lexer);
		const parser = new UCParser(tokenStream);

		try {
			lexer.reset();

			const macroStream = new CommonTokenStream(lexer, UCLexer.MACRO);
			const macroParser = new UCPreprocessorParser(macroStream);
			macroParser.removeErrorListeners(); macroParser.addErrorListener(walker);

			// TODO: strip .uci?
			macroParser.currentSymbols.set("classname", this.fileName);
			macroParser.currentSymbols.set("packagename", this.classPackage.getId().toString());
			macroParser.filePath = this.filePath;

			var macroCtx = macroParser.macros();
			this.macroTree = macroCtx;
		} catch (err) {
			console.error(
				`An error was thrown while preprocessing macros in document: "${this.filePath}",
				\n
				\t stack: "${err.stack}"`
			);
		} finally {
			lexer.reset();
		}

		const startWalking = performance.now();

		parser.interpreter.setPredictionMode(PredictionMode.SLL);
		parser.errorHandler = new BailErrorStrategy();
		parser.errorHandler = ERROR_STRATEGY;
		parser.removeErrorListeners(); parser.addErrorListener(walker);

		try {
			walker.visit(parser.program());
		} catch (err) {
			try {
				parser.reset();
				parser.interpreter.setPredictionMode(PredictionMode.LL);
				parser.errorHandler = ERROR_STRATEGY;
				walker.visit(parser.program());
			} catch (err) {
				console.error(
					`An error was thrown while walking document: "${this.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		} finally {
			console.info(this.fileName + ': Walking time ' + (performance.now() - startWalking));
		}
	}

	private readText(): string {
		const filePath = URI.parse(this.filePath).fsPath;
		const text = fs.readFileSync(filePath).toString();
		return text;
	}

	public link() {
		const start = performance.now();
		if (this.class) {
			this.class.index(this, this.class);
		}
		console.info(this.fileName + ': linking time ' + (performance.now() - start));
		documentLinked$.next(this);
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
		const diagnostics = new DiagnosticCollection();
		const analyzer = new DocumentAnalyzer(this, diagnostics);
		return this.diagnosticsFromNodes(this.nodes).concat(diagnostics.map());
	}

	private diagnosticsFromNodes(nodes: IDiagnosticNode[]) {
		return nodes
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

	indexReference(symbol: UCSymbol, ref: ISymbolReference) {
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