class ArchetypeTest extends Object;

var ArchetypeTest archetypeRef;

delegate MyDelegate(name param1, bool param2);

defaultproperties
{
    MyDelegate=none

    begin object class=ArchetypeTest name=archetype
    end object
    archetypeRef=archetype
}