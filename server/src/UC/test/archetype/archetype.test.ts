import { expect } from 'chai';

import { queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { ObjectsTable, UCArchetypeSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Archetype', () => {
    usingDocuments(__dirname, ['ArchetypeTemplate.uc', 'ArchetypeTest.uc', 'ArchetypeOverrideTest.uc'], ([
        , archetypeTestDoc, archetypeOverrideTestDoc
    ]) => {
        it('should override base archetype', () => {
            queueIndexDocument(archetypeTestDoc);
            const subSymbol = ObjectsTable.getSymbol<UCArchetypeSymbol>(toName('ArchetypeTemplate0'));
            expect(subSymbol)
                .to.not.be.undefined;
    
            queueIndexDocument(archetypeOverrideTestDoc);
            const subOverrideSymbol = ObjectsTable.getSymbol<UCArchetypeSymbol>(toName('ArchetypeTemplate0'));
            expect(subOverrideSymbol)
                .to.not.be.undefined;
        });
    });
});