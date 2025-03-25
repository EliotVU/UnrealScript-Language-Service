import { Diagnostic } from 'vscode-languageserver';

import { IDiagnosticNode } from './UC/diagnostics/diagnostic';
import { DocumentAnalyzer } from './UC/diagnostics/documentAnalyzer';
import { UCDocument } from './UC/document';

function diagnosticsFromNodes(nodes: IDiagnosticNode[]) {
    return nodes
        .map(node => {
            return Diagnostic.create(
                node.range,
                node.toString(),
                undefined,
                undefined,
                'unrealscript'
            );
        });
}

export function getDocumentDiagnostics(
    document: UCDocument
): Diagnostic[] {
    const diagnoser = new DocumentAnalyzer(document);
    document.accept(diagnoser);
    const diagnostics = diagnoser.getDiagnostics();

    return diagnosticsFromNodes(document.nodes).concat(diagnostics.toDiagnostic());
}
