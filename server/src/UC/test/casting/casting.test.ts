import { expect } from 'chai';

import { UCMethodSymbol } from '../../Symbols';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { usingDocuments } from '../utils/utils';

describe('Casting', () => {
    usingDocuments(__dirname, ['../interface/InterfaceTest.uc', 'CastingTest.uc'], ([
        interfaceTestDocument, castingTestDocument]) => {
        queueIndexDocument(castingTestDocument);

        const castingTestClass = castingTestDocument.class;

        it('should have no problems', () => {
            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            for (let field = castingTestClass.children; field; field = field.next) {
                if (field.id.name.text.startsWith('Should')) {
                    field.accept(diagnoser);
                }
            }
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(0);
        });
        
        //! Each statement is expected to report an invalid casting conversion.
        it('InvalidCastingTest should have problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('InvalidCastingTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(methodSymbol.block.statements.length);
        });
        
        it('ValidCastingTest should have no problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('ValidCastingTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(0);
        });

        //! Each statement is expected to report an invalid casting conversion.
        it('InvalidDynamicCastingInSwitchStatementTest should have problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('InvalidDynamicCastingInSwitchStatementTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(methodSymbol.block.statements.length);
        });

        it('ValidTypesInSwitchStatementTest should have no problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('ValidTypesInSwitchStatementTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            const diagnostics = diagnoser.getDiagnostics();
            const msg = diagnostics.toDiagnostic()
                .map(d => `${rangeToString(d.range)}: ${d.message}`)
                .join('\n');
            expect(diagnostics.count(), msg)
                .is.equal(0);
        });
    });
});
