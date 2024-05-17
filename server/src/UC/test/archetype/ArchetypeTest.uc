class ArchetypeTest extends Object;

const ArchetypeConst = "test";

var ArchetypeTemplate MyArchetype;

defaultproperties
{
	begin object class=ArchetypeTemplate name=ArchetypeTemplate0
        // Test for lookup of TemplateConst in subobject class 'ArchetypeTemplate'
        MyName=TemplateConst
        // Test for lookup of ArchetypeConst in document class 'ArchetypeTest'
        MyName2=ArchetypeConst
	end object
	MyArchetype=ArchetypeTemplate0
}
