import * as path from 'path';
import * as fs from 'fs';

import { URI } from 'vscode-uri';

import { Diagnostic } from 'vscode-languageserver';
import { performance } from 'perf_hooks';
import { UCLexer } from '../antlr/UCLexer';
import { UCParser, ProgramContext } from '../antlr/UCParser';
import { UCPreprocessorParser } from '../antlr/UCPreprocessorParser';
import { CommonTokenStream, ANTLRErrorListener } from 'antlr4ts';
import { PredictionMode } from 'antlr4ts/atn/PredictionMode';
import { CaseInsensitiveStream } from './Parser/CaseInsensitiveStream';

import { UCClassSymbol, ISymbol, ISymbolReference, UCPackage, UCScriptStructSymbol, UCEnumSymbol, ObjectsTable, UCFieldSymbol, UCSymbol, ClassesTable, UCStructSymbol } from './Symbols';

import { IDiagnosticNode, DiagnosticCollection } from './diagnostics/diagnostic';
import { DocumentAnalyzer } from './diagnostics/documentAnalyzer';
import { IndexedReferencesMap, applyMacroSymbols, config } from './indexer';

import { ERROR_STRATEGY } from './Parser/ErrorStrategy';
import { CommonTokenStreamExt } from './Parser/CommonTokenStreamExt';
import { DocumentASTWalker } from './documentASTWalker';

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

	public build(text: string = this.readText()) {
		console.log('building document ' + this.fileName);

		const walker = new DocumentASTWalker(this);
		const inputStream = new CaseInsensitiveStream(text);
		const lexer = new UCLexer(inputStream);
		lexer.removeErrorListeners();
		lexer.addErrorListener(walker as ANTLRErrorListener<Number>);
		const tokens = new CommonTokenStreamExt(lexer);

		const startPreprocressing = performance.now();
		const macroParser = createPreprocessor(this, lexer);
		if (macroParser) {
			try {
				const macroTree = preprocessDocument(this, macroParser, walker);
				if (macroTree) {
					lexer.reset();
					tokens.initMacroTree(macroTree, walker as ANTLRErrorListener<Number>);
				}
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

	public invalidate() {
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

		for (let symbol of this.symbols) {
			if (symbol instanceof UCStructSymbol) {
				removeObjects(symbol.children);
				// Not necessary, we don't support included documents yet!, thus no script structs nor enums without a class.
				// ObjectsTable.removeSymbol(symbol);
			}
		}

		if (this.class) {
			ClassesTable.removeSymbol(this.class);
			this.class = undefined;
		}
		this.symbols = []; // clear
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

export function createPreprocessor(document: UCDocument, lexer: UCLexer) {
	const macroStream = new CommonTokenStream(lexer, UCLexer.MACRO);
	macroStream.fill();

	if (macroStream.size <= 1) {
		return undefined;
	}

	const macroParser = new UCPreprocessorParser(macroStream);
	macroParser.filePath = document.filePath;
	return macroParser;
}

export function preprocessDocument(document: UCDocument, macroParser: UCPreprocessorParser, walker?: DocumentASTWalker) {
	if (document.fileName.toLowerCase() === 'globals.uci') {
		UCPreprocessorParser.globalSymbols = macroParser.currentSymbols;
		applyMacroSymbols(config.macroSymbols);
	}

	const classNameMacro = { text: document.fileName.substr(0, document.fileName.indexOf('.uc')) };
	macroParser.currentSymbols.set("classname", classNameMacro);

	const packageNameMacro = { text: document.classPackage.getId().toString() };
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