import { expect } from 'chai';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { UCDocument } from '../../document';

/** Runs the document's declared fields through the DocumentAnalyzer, and asserts the count of diagnostic problems that have been produced. */
export function assertDocumentAnalysis(document: UCDocument, pattern: string | RegExp) {
    expect(document.class, 'class').to.not.be.undefined;
    expect(document.class.children, 'children').to.not.be.undefined;

    const diagnoser = new DocumentAnalyzer(document);
    for (let field = document.class.children; field; field = field.next) {
        if (field.id.name.text.match(pattern)) {
            field.accept(diagnoser);
        }
    }

    return assertDocumentDiagnoser(diagnoser);
}

export function assertDocumentDiagnoser(diagnoser: DocumentAnalyzer) {
    const diagnostics = diagnoser.getDiagnostics();
    const msg = diagnostics.toDiagnostic()
        .map(d => `${rangeToString(d.range)}: ${d.message}`)
        .join('\n');

    return expect(diagnostics.count(), msg);
}
