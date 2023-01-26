import { expect } from 'chai';

import { getDocumentById, queueIndexDocument } from '../../indexer';
import { toName } from '../../name';
import { ObjectsTable, UCArchetypeSymbol } from '../../Symbols';
import { usingDocuments } from '../utils/utils';

describe('Archetype', () => {
    usingDocuments(__dirname, ['ArchetypeTemplate.uc', 'ArchetypeTest.uc', 'ArchetypeOverrideTest.uc'], () => {
        const archetypeTestDoc = getDocumentById(toName('ArchetypeTest'));
        queueIndexDocument(archetypeTestDoc);

        const subSymbol = ObjectsTable.getSymbol<UCArchetypeSymbol>(toName('ArchetypeTemplate0'));
        expect(subSymbol).to.not.be.undefined;

        const archetypeOverrideTestDoc = getDocumentById(toName('ArchetypeTestOverride'));
        queueIndexDocument(archetypeOverrideTestDoc);

        const subOverrideSymbol = ObjectsTable.getSymbol<UCArchetypeSymbol>(toName('ArchetypeTemplate0'));
        expect(subOverrideSymbol).to.not.be.undefined;
    });
});