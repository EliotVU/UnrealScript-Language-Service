import { expect } from 'chai';

import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { UCExpressionStatement } from '../../statements';
import { UCMethodSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';
import { rangeToString } from '../../diagnostics/diagnostic';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';

describe('Casting', () => {
    usingDocuments(__dirname, ['../interface/InterfaceTest.uc', 'CastingTest.uc'], ([
        interfaceTestDocument, castingTestDocument]) => {
        queueIndexDocument(castingTestDocument);

        const castingTestClass = castingTestDocument.class;
        const targetMethodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('CastingTest'));

        it('Usage in Methods', () => {
            expect(targetMethodSymbol)
                .to.not.be.undefined;

            const symbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('Created'));
            expect(symbol, 'symbol')
                .to.not.be.undefined;

            {
                const stm = symbol.block.statements[0] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(castingTestClass);
            }
            {
                const stm = symbol.block.statements[1] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(targetMethodSymbol);
            }
            // FIXME: Not yet supported
            {
                const stm = symbol.block.statements[2] as UCExpressionStatement;
                expect(stm.expression.getMemberSymbol())
                    .to.equal(targetMethodSymbol);
            }
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