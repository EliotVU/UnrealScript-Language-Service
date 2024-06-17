import { expect } from 'chai';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import { readTextByURI } from '../../../workspace';
import { ISymbol, UCFieldSymbol, isFunction, isStruct } from '../../Symbols';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { UCDocument } from '../../document';

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentValidFieldsAnalysis(document: UCDocument, pattern?: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnostics = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(document.uri, 'unrealscript', 0, readTextByURI(document.uri));

    if (typeof pattern === 'undefined') {
        document.accept(diagnoser);

        const problems = diagnostics.toDiagnostic();

        expect(problems.length).to.equal(0,
            `Expected zero problems:
                ${problems
                .map(p => `\n\t"${p.message}" for "${textDocument.getText(p.range)}" at ${rangeToString(p.range)}`)
                .join(',\n\t')
            }`);

        return;
    }

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

        if (diagnostics.count() > 0) {
            const problems = diagnostics.toDiagnostic();
            expect.fail(`Reported problem(s):
                ${problems
                    .map(p => `\n\t"${p.message}" for "${textDocument.getText(p.range)}" at ${rangeToString(p.range)}`)
                    .join(',\n\t')
                }`);
        }
    };

    TestSymbol(document.class);
}

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentValidSymbolAnalysis(document: UCDocument, symbol: ISymbol) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);

    symbol.accept(diagnoser);
    assertDocumentDiagnoser(diagnoser).to.equal(0, diagnoser.getDiagnostics().toDiagnostic().map(d => d.message).join('\n'));
}

// Will do for now, does not handle situations where a single statement may report multiple problems.
export function assertDocumentInvalidFieldsAnalysis(document: UCDocument, pattern: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnostics = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(document.uri, 'unrealscript', 0, readTextByURI(document.uri));

    for (let field = document.class.children; field; field = field.next) {
        if (isFunction(field) && field.id.name.text.match(pattern)) {
            if (field.block?.statements) for (const stm of field.block.statements) {
                diagnostics.clear();
                stm.accept(diagnoser);
                if (diagnostics.count() === 0) {
                    expect.fail(`Missing problem for "${textDocument.getText(stm.range)}" of '${field.getPath()}' at ${rangeToString(stm.range)}`);
                } else {
                    console.debug(`Validated problem for "${textDocument.getText(stm.range)}" of '${field.getPath()}' at ${rangeToString(stm.range)}`);
                }
            }
        }
    }
}

export function assertDocumentDiagnoser(diagnoser: DocumentAnalyzer) {
    const diagnostics = diagnoser.getDiagnostics();
    const msg = diagnostics.toDiagnostic()
        .map(d => `${rangeToString(d.range)}: ${d.message}`)
        .join('\n');

    return expect(diagnostics.count(), msg);
}

/** Returns the text at the range, this is slow because it will load the entire document's content. */
function getTextAtRange(document: UCDocument, range: Range): string {
    const doc = TextDocument.create(document.uri, 'unrealscript', 0, readTextByURI(document.uri));
    return doc.getText(range);
}
