import { UCMethodSymbol } from '../../Symbols';
import { DocumentAnalyzer } from '../../diagnostics/documentAnalyzer';
import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { usingDocuments } from '../utils/utils';
import { assertDocumentAnalysis, assertDocumentDiagnoser } from '../utils/diagnosticUtils';

describe('Casting', () => {
    usingDocuments(__dirname, ['../interface/InterfaceTest.uc', 'CastingTest.uc'], ([, castingTestDocument]) => {
        queueIndexDocument(castingTestDocument);
        const castingTestClass = castingTestDocument.class;

        it('should have no problems', () => {
            assertDocumentAnalysis(castingTestDocument, /\bShould/).is.equal(0);
        });

        //! Each statement is expected to report an invalid casting conversion.
        it('InvalidCastingTest should have problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('InvalidCastingTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            assertDocumentDiagnoser(diagnoser).is.equal(methodSymbol.block.statements.length);
        });

        it('ValidCastingTest should have no problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('ValidCastingTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            assertDocumentDiagnoser(diagnoser).is.equal(0);
        });

        //! Each statement is expected to report an invalid casting conversion.
        it('InvalidDynamicCastingInSwitchStatementTest should have problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('InvalidDynamicCastingInSwitchStatementTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            assertDocumentDiagnoser(diagnoser).is.equal(methodSymbol.block.statements.length);

        });

        it('ValidTypesInSwitchStatementTest should have no problems', () => {
            const methodSymbol = castingTestClass.getSymbol<UCMethodSymbol>(toName('ValidTypesInSwitchStatementTest'));

            const diagnoser = new DocumentAnalyzer(castingTestDocument);
            methodSymbol.accept(diagnoser);
            assertDocumentDiagnoser(diagnoser).is.equal(0);
        });
    });
});
