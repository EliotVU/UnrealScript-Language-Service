import { expect } from 'chai';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { UCDocument } from '../../document';
import { isFunction } from '../../Symbols';
import { Range, TextDocument } from 'vscode-languageserver-textdocument';

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentValidFieldsAnalysis(document: UCDocument, pattern?: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnostics = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(document.uri, 'unrealscript', 0, document.readText());

    if (typeof pattern === 'undefined') {
        document.accept(diagnoser);
        assertDocumentDiagnoser(diagnoser).to.equal(0, 'Expected zero problems.');
    } else {
        for (let field = document.class.children; field; field = field.next) {
            if (isFunction(field) && field.id.name.text.match(pattern)) {
                if (field.block?.statements) for (const stm of field.block.statements) {
                    diagnostics.clear();
                    stm.accept(diagnoser);
                    if (diagnostics.count() > 0) {
                        const problems = diagnostics.toDiagnostic();
                        expect.fail(`Reported problem(s) "${problems.map(p => p.message).join(',')}" in statement "${textDocument.getText(stm.getRange())}" of '${field.getPath()}' at ${rangeToString(stm.getRange())}`);
                    }
                }
            }
        }
    }
}

// Will do for now, does not handle situations where a single statement may report multiple problems.
export function assertDocumentInvalidFieldsAnalysis(document: UCDocument, pattern: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    const diagnostics = diagnoser.getDiagnostics();

    const textDocument = TextDocument.create(document.uri, 'unrealscript', 0, document.readText());

    for (let field = document.class.children; field; field = field.next) {
        if (isFunction(field) && field.id.name.text.match(pattern)) {
            if (field.block?.statements) for (const stm of field.block.statements) {
                diagnostics.clear();
                stm.accept(diagnoser);
                if (diagnostics.count() === 0) {
                    expect.fail(`Missing problem in statement "${textDocument.getText(stm.getRange())}" of '${field.getPath()}' at ${rangeToString(stm.getRange())}`);
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
    const doc = TextDocument.create(document.uri, 'unrealscript', 0, document.readText());
    return doc.getText(range);
}
