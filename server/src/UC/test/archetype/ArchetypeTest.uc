class ArchetypeTest extends Object;

const ArchetypeConst = "test";

var ArchetypeTemplate MyArchetype;

defaultproperties
{
	begin object name=ArchetypeTemplate0 class=ArchetypeTemplate
        // Test for lookup of TemplateConst in subobject class 'ArchetypeTemplate'
        MyName=TemplateConst
        // Test for lookup of ArchetypeConst in document class 'ArchetypeTest'
        MyName2=ArchetypeConst
        // Test for a contained subobject
        begin object name=ContainedArchetype0 class=ArchetypeTemplate
            MyName=TemplateConst
            MyName2=ArchetypeConst
        end object
        MyArchetype=ContainedArchetype0
	end object
	MyArchetype=ArchetypeTemplate0
}
