import { DiagnosticCollection, IDiagnosticNode } from 'UC/diagnostics/diagnostic';
import { DocumentAnalyzer } from 'UC/diagnostics/documentAnalyzer';
import { UCDocument } from 'UC/document';
import { Diagnostic } from 'vscode-languageserver';

export function diagnosticsFromNodes(nodes: IDiagnosticNode[]) {
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

export function getDiagnostics(document: UCDocument): Diagnostic[] {
    const diagnostics = new DiagnosticCollection();
    (new DocumentAnalyzer(document, diagnostics));
    return diagnosticsFromNodes(document.nodes).concat(diagnostics.map());
}
