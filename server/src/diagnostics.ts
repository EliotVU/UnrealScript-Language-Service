import { Diagnostic } from 'vscode-languageserver';

import { IDiagnosticNode } from './UC/diagnostics/diagnostic';
import { DocumentAnalyzer } from './UC/diagnostics/documentAnalyzer';
import { UCDocument } from './UC/document';

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
    const documentAnalyzer = new DocumentAnalyzer(document);
    const diagnostics = documentAnalyzer.visitDocument(document);
    return diagnosticsFromNodes(document.nodes).concat(diagnostics.map());
}