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

import { UCClassSymbol, ISymbol, ISymbolReference, UCPackage, UCScriptStructSymbol, UCEnumSymbol, ObjectsTable, UCFieldSymbol, UCSymbol } from './Symbols';

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

	private readonly indexReferencesMade = new Map<number, Set<ISymbolReference>>();

	// List of symbols, including macro declarations.
	private symbols: UCSymbol[] = [];

	constructor(public readonly filePath: string, public classPackage: UCPackage) {
		this.fileName = path.basename(filePath, '.uc');
	}

	public getSymbols() {
		return this.symbols;
	}

	public addSymbol(symbol: UCSymbol) {
		this.symbols.push(symbol);
	}

	public preprocess(lexer: UCLexer, walker?: DocumentASTWalker) {
		const macroStream = new CommonTokenStream(lexer, UCLexer.MACRO);
		macroStream.fill();

		if (macroStream.size <= 1) {
			return undefined;
		}

		const macroParser = new UCPreprocessorParser(macroStream);
		macroParser.filePath = this.filePath;

		if (this.fileName.toLowerCase() === 'globals.uci') {
			UCPreprocessorParser.globalSymbols = macroParser.currentSymbols;
		}

		// TODO: strip .uci?
		const classNameMacro = { text: this.fileName };
		const packageNameMacro = { text: this.classPackage.getId().toString() };
		macroParser.currentSymbols.set("classname", classNameMacro);
		macroParser.currentSymbols.set("packagename", packageNameMacro);

		if (walker) {
			macroParser.removeErrorListeners();
			macroParser.addErrorListener(walker);
		}
		const macroCtx = macroParser.macroProgram();
		if (walker) {
			walker.visit(macroCtx);
		}
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
				parser.reset(true);
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
		tokens.release(tokens.mark());
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
			try {
				this.class.index(this, this.class);
			} catch (err) {
				console.error(
					`An error was thrown while indexing document: "${this.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		}
		console.info(this.fileName + ': linking time ' + (performance.now() - start));
		documentLinked$.next(this);
	}

	// To be initiated after we have linked all dependencies, so that deep recursive context references can be resolved.
	public postLink() {
		if (this.class) {
			try {
				const indexer = new DocumentIndexer(this);
				this.class.accept<any>(indexer);
			} catch (err) {
				console.error(
					`An error was thrown while post indexing document: "${this.filePath}",
					\n
					\t stack: "${err.stack}"`
				);
			}
		}
	}

	public invalidate() {
		if (this.class) {
			// naive implementation, what if two classes have an identical named struct?
			function removeObjects(child?: UCFieldSymbol) {
				for (; child; child = child.next) {
					if (child instanceof UCScriptStructSymbol || child instanceof UCEnumSymbol) {
						if (child.children) {
							removeObjects(child.children);
						}
						ObjectsTable.removeSymbol(child);
					}
				}
			}
			removeObjects(this.class.children);

			delete this.class;
		}

		this.nodes = []; // clear
		this.hasBeenIndexed = false;

		// Clear all the indexed references that we have made.
		for (let [key, value] of this.indexReferencesMade) {
			const refs = IndexedReferencesMap.get(key);
			if (refs) {
				value.forEach(ref => refs.delete(ref));
			}
		}
		this.indexReferencesMade.clear();
	}

	public analyze(): Diagnostic[] {
		const diagnostics = new DiagnosticCollection();
		try {
			(new DocumentAnalyzer(this, diagnostics));
		} catch (err) {
			console.error(
				`An error was thrown while analyzing document: "${this.filePath}",
				\n
				\t stack: "${err.stack}"`
			);
		}
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

	indexReference(symbol: ISymbol, ref: ISymbolReference) {
		const key = symbol.getHash();
		const value = this.indexReferencesMade.get(key);

		const set = value || new Set<ISymbolReference>();
		set.add(ref);

		if (!value) {
			this.indexReferencesMade.set(key, set);
		}

		// TODO: Refactor this, we are pretty much duplicating this function's job.
		const gRefs = IndexedReferencesMap.get(key) || new Set<ISymbolReference>();
		gRefs.add(ref);
		IndexedReferencesMap.set(key, gRefs);
	}
}