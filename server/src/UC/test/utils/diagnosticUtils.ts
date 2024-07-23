import { expect } from 'chai';
import type { Diagnostic } from 'vscode-languageserver';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { readTextByURI } from '../../../workspace';
import { ISymbol, UCFieldSymbol, isFunction, isStruct } from '../../Symbols';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { UCDocument } from '../../document';
import { areRangesIntersecting } from '../../helpers';

/** Returns the text at the range, this is slow because it will load the entire document's content. */
function getTextAtRange(document: UCDocument, range: Range): string {
    const textDocument = TextDocument.create(
        document.uri,
        'unrealscript',
        0,
        readTextByURI(document.uri)
    );

    return textDocument.getText(range);
}

function getAtRangeDebugInfo(textDocument: TextDocument, range: Range): string {
    return `${URI.parse(textDocument.uri).fsPath}:${range.start.line + 1}:${range.start.character + 1}`;
}

function getAtSymbolDebugInfo(textDocument: TextDocument, symbol: ISymbol): string {
    return `${symbol.getPath()} (${URI.parse(textDocument.uri).fsPath}:${symbol.range.start.line + 1}:${symbol.range.start.character + 1})`;
}

function getDiagnosticsDebugInfo(textDocument: TextDocument, diagnostics: Diagnostic[]): string[] {
    return diagnostics.map(p => {
        return p.code !== Number.MAX_VALUE
            ? (`UnrealScriptError: "${p.message}" for \`${textDocument.getText(p.range)}\`\n    at ${getAtRangeDebugInfo(textDocument, p.range)}`)
            : p.message;
    });
}

function getDiagnosticsError(textDocument: TextDocument, diagnostics: Diagnostic[]): string {
    const errors = getDiagnosticsDebugInfo(textDocument, diagnostics);

    return errors
        .join('\n');
}

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentValidFieldsAnalysis(document: UCDocument, pattern?: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnosticCollection = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(
        document.uri,
        'unrealscript',
        0,
        readTextByURI(document.uri)
    );

    if (typeof pattern === 'undefined') {
        document.accept(diagnoser);

        const problems = diagnosticCollection.toDiagnostic();
        expect(problems.length)
            .to.equal(0, getDiagnosticsError(textDocument, problems));

        return;
    }

    const problems: Diagnostic[] = [];

    const TestSymbol = (symbol: ISymbol) => {
        if (isStruct(symbol) && symbol.children) {
            const symbols: ISymbol[] = Array(symbol.childrenCount());

            for (let child: UCFieldSymbol | undefined = symbol.children, i = 0; child; child = child.next, ++i) {
                symbols[i] = child;
            }

            for (let i = symbols.length - 1; i >= 0; --i) {
                TestSymbol(symbols[i]);
            }
        }

        if (!symbol.id.name.text.match(pattern)) {
            return;
        }

        symbol.accept(diagnoser);

        if (diagnosticCollection.count() === 0) {
            return;
        }

        problems.push({
            message: `at ${getAtSymbolDebugInfo(textDocument, symbol)}`,
            range: symbol.id.range,
            code: Number.MAX_VALUE
        });
        problems.push(...diagnosticCollection.toDiagnostic());

        diagnosticCollection.clear(); // clear for the next set of diagnostics (because we want to assert all errors at once)
    };

    TestSymbol(document.class);

    if (problems.length > 0) {
        expect.fail(getDiagnosticsError(textDocument, problems));
    }
}

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentValidSymbolAnalysis(document: UCDocument, symbol: ISymbol) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);

    symbol.accept(diagnoser);

    assertDocumentDiagnoser(diagnoser)
        .to.equal(0, diagnoser
            .getDiagnostics()
            .toDiagnostic()
            .map(d => d.message)
            .join('\n')
        );
}

// Will do for now, does not handle situations where a single statement may report multiple problems.
export function assertDocumentInvalidFieldsAnalysis(document: UCDocument, pattern: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnosticCollection = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(
        document.uri,
        'unrealscript',
        0,
        readTextByURI(document.uri)
    );

    const problems: Diagnostic[] = [];

    for (let field = document.class.children; field; field = field.next) {
        if (!(isFunction(field) && field.id.name.text.match(pattern))) {
            continue;
        }

        diagnoser.visitMethod(field);
        const diagnostics = diagnosticCollection.toDiagnostic();

        // Catch one by one now.
        if (field.block?.statements) for (const stm of field.block.statements) {
            if (!diagnostics.some(d => areRangesIntersecting(d.range, stm.range))) {
                problems.push({
                    message: `statement is missing diagnostics`,
                    range: stm.range,
                });

                continue;
            }

            diagnosticCollection.clear(); // clear for the next set of diagnostics (because we want to assert all errors at once)
        }
    }

    if (problems.length > 0) {
        expect.fail(`Missing diagnostics ${getDiagnosticsError(textDocument, problems)}`);
    }
}

export function assertDocumentDiagnoser(diagnoser: DocumentAnalyzer) {
    const diagnostics = diagnoser.getDiagnostics();
    const msg = diagnostics.toDiagnostic()
        .map(d => `${rangeToString(d.range)}: ${d.message}`)
        .join('\n');

    return expect(diagnostics.count(), msg);
}
