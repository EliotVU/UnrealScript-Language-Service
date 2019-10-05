import { Subject } from 'rxjs';

import * as path from 'path';
import * as fs from 'fs';

import { URI } from 'vscode-uri';

import { Diagnostic, Position } from 'vscode-languageserver';
import { performance } from 'perf_hooks';
import { UCLexer } from '../antlr/UCLexer';
import { UCParser, ProgramContext } from '../antlr/UCParser';
import { UCPreprocessorParser } from '../antlr/UCPreprocessorParser';
import { CommonTokenStream, ANTLRErrorListener } from 'antlr4ts';
import { PredictionMode } from 'antlr4ts/atn/PredictionMode';
import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';

import { UCClassSymbol, ISymbol, ISymbolReference, UCPackage, UCSymbol } from './Symbols';

import { IDiagnosticNode, DiagnosticCollection } from './diagnostics/diagnostic';
import { DocumentAnalyzer } from './diagnostics/documentAnalyzer';
import { IndexedReferencesMap } from './indexer';

import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { CommonTokenStreamExt } from './Parser/CommonTokenStreamExt';
import { DocumentASTWalker } from './documentASTWalker';
import { DocumentIndexer } from './documentIndexer';

export const documentLinked$ = new Subject<UCDocument>();

export class UCDocument {
	/** Parsed file name filtered of path and extension. */
	public readonly fileName: string;

	// TODO: Displace this with a DiagnosticCollection visitor.
	public nodes: IDiagnosticNode[] = [];

	public class?: UCClassSymbol;
	public hasBeenIndexed = false;

	private readonly indexReferencesMade = new Map<string, ISymbolReference | ISymbolReference[]>();

	constructor(public readonly filePath: string, public classPackage: UCPackage) {
		this.fileName = path.basename(filePath, '.uc');
	}

	public getSymbolAtPos(position: Position): ISymbol | undefined {
		return this.class && this.class.getSymbolAtPos(position);
	}

	public preprocess(lexer: UCLexer, walker?: DocumentASTWalker) {
		const macroStream = new CommonTokenStream(lexer, UCLexer.MACRO);
		macroStream.fill();

		if (macroStream.size <= 1) {
			return undefined;
		}

		const macroParser = new UCPreprocessorParser(macroStream);
		if (walker) {
			macroParser.removeErrorListeners();
			macroParser.addErrorListener(walker);
		}

		// TODO: strip .uci?
		macroParser.currentSymbols.set("classname", this.fileName);
		macroParser.currentSymbols.set("packagename", this.classPackage.getId().toString());
		macroParser.filePath = this.filePath;

		const macroCtx = macroParser.macroProgram();
		return macroCtx;
	}

	public build(text: string = this.readText()) {
		console.log('building document ' + this.fileName);

		const walker = new DocumentASTWalker(this);
		const inputStream = new CaseInsensitiveStream(text);
		const lexer = new UCLexer(inputStream);
		lexer.removeErrorListeners();
		lexer.addErrorListener(walker as ANTLRErrorListener<Number>);
		const tokens = new CommonTokenStreamExt(lexer);

		const startPreprocressing = performance.now();
		const macroTree = this.preprocess(lexer, walker);
		if (macroTree) {
			try {
				lexer.reset();
				tokens.initMacroTree(macroTree, walker as ANTLRErrorListener<Number>);
			} catch (err) {
				console.error(err);
			} finally {
				console.info(this.fileName + ': preprocessing time ' + (performance.now() - startPreprocressing));
			}
		}

		const startWalking = performance.now();
		tokens.fill();

		let context: ProgramContext | undefined;
		const parser = new UCParser(tokens);
		try {
			parser.interpreter.setPredictionMode(PredictionMode.SLL);
			parser.errorHandler = ERROR_STRATEGY;
			parser.removeErrorListeners();
			parser.addErrorListener(walker);
			context = parser.program();
		} catch (err) {
			console.debug('PredictionMode SLL has failed, rolling back to LL.');
			try {
				this.nodes = [];

				parser.reset();
				parser.interpreter.setPredictionMode(PredictionMode.LL);
				parser.errorHandler = ERROR_STRATEGY;
				parser.removeErrorListeners();
				parser.addErrorListener(walker);
				context = parser.program();
			} catch (err) {
				console.error(
					`An error was thrown while parsing document: "${this.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		} finally {
			try {
				if (context) {
					walker.tokenStream = tokens;
					walker.visit(context);
				}
			} catch (err) {
				console.error(
					`An error was thrown while walking document: "${this.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
			console.info(this.fileName + ': Walking time ' + (performance.now() - startWalking));
		}
	}

	public readText(): string {
		const filePath = URI.parse(this.filePath).fsPath;
		const text = fs.readFileSync(filePath).toString();
		return text;
	}

	public link() {
		this.hasBeenIndexed = true;
		const start = performance.now();
		if (this.class) {
			this.class.index(this, this.class);
		}
		console.info(this.fileName + ': linking time ' + (performance.now() - start));
		documentLinked$.next(this);
	}

	// To be initiated after we have linked all dependencies, so that deep recursive context references can be resolved.
	public postLink() {
		if (this.class) {
			const indexer = new DocumentIndexer(this);
			this.class.accept(indexer);
		}
	}

	public invalidate() {
		delete this.class;
		this.nodes = []; // clear
		this.hasBeenIndexed = false;

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

		// TODO: build macro symbols, and walk those instead.
		// if (this.macroTree) {
		// 	const mNodes = this.macroTree.macroStatement();
		// 	for (let mNode of mNodes) {
		// 		const macro = mNode.macro();
		// 		const isActive = macro.isActive;
		// 		if (!isActive) {
		// 			diagnostics.add({
		// 				message: { text: 'This macro is inactive.' },
		// 				range: rangeFromBounds(mNode.start, mNode.stop),
		// 				custom: { unnecessary: true }
		// 			});
		// 		}
		// 	}
		// }

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